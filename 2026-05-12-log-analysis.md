# Migration & Error Log Analysis — 2026-05-12

Source: `./logs/error-2026-05-12.log*` and `./logs/migration-2026-05-12.log*`
Project: agentcis → applyims ETL (Phase 2), staging environment.

## Summary

- ~15 distinct migration runs on 2026-05-12 between 04:29 UTC and 11:09 UTC — repeated retries, not a single run.
- Total error events on 2026-05-12 across all error log rotations: ~1.6M (mostly `TRANSFORMATION_ERROR`, ~14K `API_ERROR`).
- The final 3 runs (`d3cf4c23`, `014b16b1`, `996c38d8`, 11:03–11:09 UTC) never started — they failed on `POST /auth/login` with `ECONNABORTED` (30s timeout). The local ApplyIMS API at `http://localhost:3000` was unreachable.
- Earlier runs reached the entity loop but consistently produced 0 successful `users` and 0 successful downstream rows, cascading failures into `contacts → deals → applications → contact-activities → office-visits → attachments`.

Runs that DID land partial data:

| migrationId | started | notable totals |
|---|---|---|
| `a70be544` | 05:05 | contacts 6957/22154, deals 11300/11300, applications 1728/11794, contact-activities 10658/58414, office-visits 37422/37951, attachments 6417/18249 |
| `eeca671c` | 10:05 | contacts 21747/22154 |
| `79a76d63` | 10:24 | users 0/60, agents 12/10, contacts 21747/22154 (98.2%), deals 36086/36086, applications 7702/11794 (65.3%) — contact-activities cut off mid-run |

Multiple runs (`d103b9cc`, `3fa83684`, `92205479`, `ce3fe70d`, `b9080bbf`, `340ad464`) recorded `successful=0` across all entities even though `total` was non-zero — extraction worked, but every record either failed transform or failed API write.

## Aggregate error counts (latest rotation, `error-2026-05-12.log.4`)

By category:

| Category | Count |
|---|---|
| TRANSFORMATION_ERROR | 120,269 |
| API_ERROR | 4,036 |

By entity:

| Entity | Errors |
|---|---|
| contact-activities | 155,502 |
| applications | 53,730 |
| office-visits | 31,376 |
| contacts | 3,784 |
| users | 244 |
| agents | 4 |

Top transformation error messages:

| Count | Entity | Message (templated) |
|---|---|---|
| 53,986 | contact-activities | Cannot resolve activitiesTypeId for `<id>` |
| 23,745 | contact-activities | Cannot resolve contactId `<id>` |
| 22,904 | applications | Cannor resolve dealId for application `<id>` *(sic — typo in source)* |
| 15,598 | office-visits | Cannot resolve contactId `<id>` |
| 3,733 | applications | Cannot read properties of null (reading 'toISOString') |
| 152 | applications | Cannot resolve institutionBranchId `<id>` |
| 76 | applications | Cannot resolve contactId `<id>` |
| 59 | office-visits | Cannot resolve userId `<id>` |
| 16 | contact-activities | Cannot resolve userId `<id>` |

Top API error messages:

| Count | Entity | Message |
|---|---|---|
| 3,725 | contacts | duplicate key value violates unique constraint `IDX_LOWERCASE_EMAIL` |
| 240 | users | duplicate key value violates unique constraint `unique_email` |
| 31 | office-visits | Request failed with status code 500 |
| 14 | contacts | Request failed with status code 500 |
| 13 | contacts | timeout of 30000ms exceeded |
| 5 | contacts | duplicate key value violates unique constraint `contact_follower_uniq_idx` |
| 4 | contact-activities | Request failed with status code 500 |
| 2 | users | Request failed with status code 500 |
| 2 | agents | Request failed with status code 500 |

---

## Issues

```
[
Issue Type:        Authentication / Network — migration aborts before starting
Severity:          CRITICAL
Affected Component: src/loaders/api-client.ts:84 (authenticate) → src/orchestrators/migration.orchestrator.ts:606 (validateCredentials) → :141 (runMigration)
Root Cause:        POST http://localhost:3000/auth/login times out (ECONNABORTED, 30000ms). Three consecutive runs failed back-to-back at 11:03:53, 11:07:48, 11:09:28. ApplyIMS API was down, unreachable, or saturated on the local host.
Evidence:          End of error-2026-05-12.log.4, migrationIds d3cf4c23-..., 014b16b1-..., 996c38d8-...
Impact:            No data migrated on those runs. Repeated 30s blocking timeouts compound operator wait time. Risk that the API was overloaded by preceding runs (see "duplicate writes" issue below).
Recommended Fix:   1) Verify the API process is running and healthy before re-running. 2) Add a short health-check (GET /health, ~2s timeout) before auth in validateCredentials and short-circuit with a clear error. 3) Reduce login timeout to ~10s — 30s blind blocking is excessive for an auth endpoint.
Preventive Measure: Add liveness probe + circuit breaker on the ApplyIMS client. Surface backend status in pre-flight check.
]

[
Issue Type:        Users entity producing 0 successes ("successful":0,"total":60)
Severity:          HIGH
Affected Component: users entity (extractor → API)
Root Cause:        240 API errors of the form `duplicate key value violates unique constraint "unique_email"`. Users were already inserted in a prior run; subsequent runs hit unique_email and the entire bulk insert returns 0 successful per batch. Some runs (`f5323f8d`, `4d069d81`, `eeca671c`, `340ad464`) succeeded 60/60 — likely after a target DB reset.
Evidence:          jq breakdown: 240 × "duplicate key value violates unique constraint \"unique_email\"" on entityType=users.
Impact:            Confirmed downstream cascade: when users=0 succeed, the `temp_mapped_users` table stays empty, every contact/deal/activity that joins userId becomes unresolvable.
Recommended Fix:   1) Make the users bulk-create idempotent — switch to upsert (ON CONFLICT (email) DO UPDATE … RETURNING id) or pre-fetch existing users by email and skip them. 2) On duplicate, the batch processor should still record the existing UUID into temp_mapped_users so downstream resolution works. Today a duplicate is treated as a hard failure and no mapping is stored.
Preventive Measure: Always populate temp_mapped_users from existing target rows at the start of a users migration, then only insert the delta.
]

[
Issue Type:        Contacts entity producing 0 successes on re-runs
Severity:          HIGH
Affected Component: contacts entity
Root Cause:        3725 `duplicate key value violates unique constraint "IDX_LOWERCASE_EMAIL"` API errors. Same idempotency gap as users — a contact with the same lowercase(email) already exists from an earlier run, the bulk insert rejects, and no mapping is stored, so the contact is treated as failed even though it physically exists. 5 additional `contact_follower_uniq_idx` collisions on a contact-follower table.
Evidence:          API_ERROR rollup; runs `340ad464`, `b9080bbf`, `d103b9cc` show contacts=0/22154 while contacts=21747 in `79a76d63` (the first run of the day).
Impact:            Every contact_activity, office_visit, application that references those 21747 contacts loses its mapping on re-runs ⇒ massive downstream `Cannot resolve contactId` cascade.
Recommended Fix:   Same as users: pre-load existing contacts (by lower(email)) into temp_mapped_contacts before extraction, then only insert the delta. On duplicate-key, look up existing UUID and write the mapping rather than logging as a hard error.
Preventive Measure: Standardize an "idempotent bulk-create" pattern in api-client.ts that all entity loaders share.
]

[
Issue Type:        contact-activities transformer mass failure — "Cannot resolve activitiesTypeId for <id>"
Severity:          HIGH (but partly mislabelled — see Note)
Affected Component: src/transformers/contact-activity.transformer.ts
Root Cause:        The variable named `activitiesTypeId` is actually populated from `resolveApplicationId(applicationId)` (see contact-activity.transformer.ts line containing `const activitiesTypeId = await this.idResolver.resolveApplicationId(applicationId)`). The throw message therefore prints "activitiesTypeId for <applicationId>". So the real meaning is "cannot resolve the migrated application ID for this contact-activity". Volume: 53,986 (latest run) + 92,876 (earlier run) — driven by the same cause as the next issue: applications either didn't migrate or were not committed to temp_mapped_applications.
Evidence:          9,116 distinct source IDs cited; applications run in `79a76d63` only succeeded 7702/11794 — the unmapped 4092 plus all applications from failed runs explain the cascade.
Impact:            Activity loses its application linkage. If migrated anyway with a null/placeholder it would create orphaned activities; current behavior throws, so activity is just dropped.
Recommended Fix:   1) Fix the misleading error message — rename the variable to `applicationIdMapped` and update the thrown string to `Cannot resolve applicationId <id> for contact-activity <activityId>` so it's diagnosable. 2) Fix the application migration first (next issue); this cascade resolves itself once applications=100%.
Preventive Measure: Lint rule / code review: any `throw` message in transformers must reference the source variable name accurately. Add a unit test for resolver-miss messages.
]

[
Issue Type:        Applications transformer/loader — "Cannor resolve dealId for application <id>"
Severity:          HIGH
Affected Component: src/transformers/application.transformer.ts (typo "Cannor" remains in source)
Root Cause:        22,904 application records reference a dealId that is missing from temp_mapped_deals + deals.json mapper. Run `79a76d63` recorded deals 36086/36086 successful, but earlier runs had deals 0/0 — so re-runs that depended on this run's deal map worked, but cross-run runs without the mapper file regenerated fail. Combined with `Cannot resolve contactId` (26,017 occurrences) — applications also need contact mapping that is missing on re-runs.
Evidence:          Error message string is verbatim "Cannor resolve dealId" — confirmed typo in source.
Impact:            ~22.9K applications skipped → cascades into ~54K+ contact-activities and downstream attachments.
Recommended Fix:   1) Fix the typo in the error string. 2) Ensure deal mapping is durable (write to temp_mapped_deals immediately upon success, not at end-of-batch) so a mid-run crash doesn't lose mappings. 3) Verify that the JSON mapper file for deals is in sync with the latest extraction; if a deal was created in run N, run N+1 should find it.
Preventive Measure: Generate JSON mapper files automatically from temp_mapped_* at the end of every successful entity stage; load them at the start of every run.
]

[
Issue Type:        Applications transformer NullPointerException — "Cannot read properties of null (reading 'toISOString')"
Severity:          MEDIUM
Affected Component: src/transformers/application.transformer.ts
Root Cause:        A nullable Date column (createdAt / updatedAt / intake / startDate / similar) is being unconditionally `.toISOString()`'d. 3,733 + 1,964 + 84 occurrences across runs.
Evidence:          Volume is consistent across runs (~3.7K) suggesting a deterministic subset of source rows with a null timestamp.
Impact:            Application records silently dropped (transform error → skipped). Confirmed data loss for ~3.7K applications.
Recommended Fix:   In application.transformer.ts, guard every `.toISOString()` call: `value ? new Date(value).toISOString() : null`. Identify which field is null in the source — likely `submittedAt` or `intakeDate` based on Phase 2 schema. Add a SQL probe: `SELECT COUNT(*) FROM agentcis_v2.applications WHERE <suspect_field> IS NULL` to confirm.
Preventive Measure: Pre-flight a transformer dry-run that surfaces NPEs (the existing /api/test/contact-transform pattern) on a random sample of N=1000 rows before running the full migration.
]

[
Issue Type:        office-visits — Cannot resolve contactId
Severity:          HIGH
Affected Component: src/transformers/office-visit.transformer.ts
Root Cause:        15,598 + 39,800 + 3389 across runs — same contact-mapping cascade as above. Plus 59 `Cannot resolve userId <id>` and 517 `Cannot resolve userId null` (raw null in source).
Evidence:          office-visits in `a70be544` only achieved 37422/37951 (529 dropped). userId null source rows need explicit handling.
Impact:            Office visits with null users get dropped. May need to fall back to a system user.
Recommended Fix:   1) Solve contacts idempotency (above). 2) For null userId, decide policy: fall back to `applicantOwner` user, a tenant default user, or drop with a WARNING-level log. Don't silently throw.
Preventive Measure: Add coverage test using a fixture with a null source userId.
]

[
Issue Type:        contacts API timeouts and 500s
Severity:          MEDIUM
Affected Component: src/loaders/api-client.ts → ApplyIMS bulk endpoint
Root Cause:        13 × `timeout of 30000ms exceeded` and 14 × HTTP 500 on contacts; also 31 × 500 on office-visits, 4 × 500 on contact-activities, 2 × 500 on users, 2 × 500 on agents.
Evidence:          Sequence at end of error-2026-05-12.log.4 — every 30s a single contact bulk-batch times out and produces a single API_ERROR entry, suggesting the API server (localhost:3000) was crashed/restarting at 10:57–11:02 UTC, right before the three login-timeout failures.
Impact:            Affected batches lost. axios-retry config shows `retries: 3` but the events appear to be after all retries exhausted.
Recommended Fix:   1) Run the API behind a process manager that restarts on crash. 2) Move contacts batch size down if 500s correlate with payload size. 3) Surface API 500 response body in the log — current entries have no upstream detail.
Preventive Measure: Add upstream HTTP body capture on non-2xx responses to api-client.ts.
]

[
Issue Type:        Plaintext credentials in error logs
Severity:          MEDIUM (security)
Affected Component: error-2026-05-12.log.4 (and predecessors)
Root Cause:        On axios timeout, the full request config is dumped including `"data":"{\"email\":\"developers@heubert.com\",\"password\":\"159753\",\"domain\":\"http://localhost\"}"`.
Evidence:          Three full ECONNABORTED traces at end of error-2026-05-12.log.4 contain the cleartext password.
Impact:            Logs become a credential disclosure surface; rotate the password and scrub these log lines.
Recommended Fix:   1) Rotate the `developers@heubert.com` password immediately. 2) Add an axios interceptor that redacts `password`, `secret`, `token`, and `Authorization` fields before logging. 3) Sanitize the existing log files (gz + .log) or move them outside the repo.
Preventive Measure: A logger sanitization layer with a deny-list of field names.
]

[
Issue Type:        Bulk insert "successful" count off-by-one for agents
Severity:          LOW
Affected Component: agents loader/orchestrator counters
Root Cause:        Every agents run reports `successful=12/total=10`. Either the counter increments on returned response IDs (12 returned for 10 sent) or the extractor double-counts. Cosmetic, but it suggests a count divergence in the loader.
Evidence:          Repeated in every migrationId on 2026-05-12.
Impact:            Misleading metrics, low data risk.
Recommended Fix:   Inspect agents bulkCreate response handling in api-client.ts and batch-processor.ts; ensure `successful` ≤ `total`.
Preventive Measure: Assert `successful <= total` in the orchestrator before logging entity completion.
]
```

---

## Pattern correlation

1. **Single root cause behind ~95% of transformation errors:** users and contacts are not idempotent on re-runs. As soon as you re-run after the target had data, users=0 and contacts=0 succeed → temp_mapped_* tables are empty → every downstream entity throws `Cannot resolve <fk>Id`. This explains the consistent shape across `d103b9cc`, `3fa83684`, `92205479`, `b9080bbf`, `340ad464`.
2. **The day's chronology** strongly suggests an operator iterating: a fresh full run (`a70be544` at 05:05 — actually wrote data), several broken re-runs (06:17 onward), then a partial recovery (`79a76d63` at 10:24 — likely after a target wipe), and finally three failures at 11:03–11:09 when the local API itself stopped responding.
3. **The "activitiesTypeId" wording is a red herring** — it masks an applicationId mapping miss. Without renaming, future readers (and you, on the next incident) will chase the wrong field.

## Top recommendations (ranked)

1. **CRITICAL:** Restore/health-check `http://localhost:3000` and add a pre-flight liveness probe to the orchestrator.
2. **HIGH:** Make users + contacts loaders idempotent — pre-load existing UUIDs into temp_mapped_* on every run. This single fix likely eliminates >1M error events.
3. **HIGH:** Fix the `application.transformer.ts` toISOString NPE — guard nullable date fields.
4. **MEDIUM:** Rename `activitiesTypeId` and fix the `Cannor`→`Cannot` typo in error messages.
5. **MEDIUM:** Rotate the developer password and add a log-redaction interceptor; sanitize today's log files.
6. **LOW:** Investigate the agents `12/10` counter discrepancy.

## Confidence

- HIGH on cause/effect for items 2, 3, 4, 5 (direct log evidence + source confirmation).
- MEDIUM-HIGH on item 1 (logs prove the timeouts; root cause of the API outage is not in these logs).
- LOW-MEDIUM on item 6 (counter could legitimately reflect upstream behavior we haven't seen).
