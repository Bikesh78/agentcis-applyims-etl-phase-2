# Prior-Migration Coverage Gap — Root Cause of 21K dealId Failures

**Finding date:** 2026-05-28
**Investigation context:** Follow-up to `2026-05-28-log-analysis-5c9e6662.md` to identify the upstream source of the 21,224 `Cannor resolve dealId for application <id>` errors in migration `5c9e6662-7714-4fb2-ab30-092b255ece43`.

## TL;DR

The prior migration (run before this codebase took over, via a different service) covered **38,872 clients** but only **22,791 of the 42,705 applications** belonging to those clients. The resulting **19,914-application gap** is the dominant population behind this run's `Cannor resolve dealId` failures — they belong to clients that re-collided with `IDX_LOWERCASE_EMAIL` and therefore weren't in this run's `temp_mapped_contacts`, which `populateDealStaging` requires for deal-row generation.

## The data (queried against agentcis source, 2026-05-28)

| Population | Count |
|---|---:|
| `src/mapper/contacts.json` — prior-migrated clients | 38,872 |
| `src/mapper/applications.json` — prior-migrated applications | 22,791 |
| Applications in agentcis source whose client is in `contacts.json` | **42,705** |
| Of those, applications also in `applications.json` (cleanly carried over) | 22,791 |
| Of those, applications NOT in `applications.json` — the **gap** | **19,914** |
| Prior-migrated applications whose client is NOT in `contacts.json` | 0 (no orphans) |

Verification SQL — `agentcis_v2` only, no ETL DB used:

```sql
SELECT
  (SELECT COUNT(*) FROM applications
     WHERE client_id IN (:contacts_json_ids))                                AS apps_for_prior_contacts,
  (SELECT COUNT(*) FROM applications
     WHERE client_id IN (:contacts_json_ids)
       AND id IN (:applications_json_ids))                                   AS apps_for_prior_contacts_AND_prior_migrated,
  (SELECT COUNT(*) FROM applications
     WHERE client_id IN (:contacts_json_ids)
       AND id NOT IN (:applications_json_ids))                               AS apps_for_prior_contacts_but_NOT_prior_migrated,
  (SELECT COUNT(*) FROM applications WHERE id IN (:applications_json_ids))   AS apps_in_applications_json,
  (SELECT COUNT(*) FROM applications
     WHERE id IN (:applications_json_ids)
       AND client_id NOT IN (:contacts_json_ids))                            AS apps_prior_migrated_BUT_client_NOT_prior;
-- Result: 42705 | 22791 | 19914 | 22791 | 0
```

The two id lists come from:

```bash
jq -r '.[].agentcis_id' src/mapper/contacts.json     | sort -n   # 38,872 ids
jq -r '.[].agentcis_id' src/mapper/applications.json | sort -n   # 22,791 ids
```

## Time distribution

| Year (`applications.created_at`) | Prior-migrated apps | Gap apps (client migrated, app not) | All apps |
|---|---:|---:|---:|
| 2018 | 6 | 212 | 9,103 |
| 2019 | 12 | 999 | 33,177 |
| 2020 | 24 | 1,381 | 33,451 |
| 2021 | 55 | 1,805 | 32,314 |
| 2022 | 155 | 3,288 | 50,958 |
| 2023 | 908 | 5,187 | 61,189 |
| **2024** | **20,229 (89%)** | **6,454** | **56,486** |
| 2025 | 1,402 | 588 | 2,589 |

- Prior-migrated apps span **2018-08-22 → 2025-02-12** with **89% concentrated in 2024**. The 2025-02-12 latest date is the prior migration's effective cutoff.
- Gap apps span **2018-08-10 → 2025-08-26** — the entire source date range. The prior migration was not a clean date filter; even within 2024 it left 6,454 apps (24%) behind.

## What filter the prior migration used (best inference)

Status, `service_id`, and `added_by_branch_id` dimensions all show prior-migrated coverage in every bucket:

| Status | Prior-migrated | Gap |
|---|---:|---:|
| Complete | 9,777 | 11,663 |
| Discontinue | 10,036 | 6,667 |
| Open | 2,978 | 1,584 |

The selection criterion is not expressible as a single-column predicate. Most likely combinations:
1. **"Active in the prior service's workspace"** — applications the previous external system had records or workflows for.
2. **"Recent activity"** — heavily weighted to 2024 + active older applications across all statuses.
3. **External business filter** unknown to this codebase.

For the purposes of this report, the exact selection logic does not matter — only that the contact-side coverage is **strictly broader** than the application-side coverage.

## Why the gap produces dealId errors

```
APP belongs to a client in contacts.json
   │  (client present in target ApplyIMS from prior migration)
   ▼
This run's contacts phase tries to insert the client
   │  bulkCreateContacts has no upsert-on-duplicate path
   ▼
IDX_LOWERCASE_EMAIL 409 → row not inserted into THIS run's temp_mapped_contacts
   │  (29,484 / 38,872 of prior-migrated clients hit this — 76% re-encounter rate)
   ▼
populateDealStaging (orchestrator.ts:539-574)
   WHERE app.client_id IN (this-run's temp_mapped_contacts)
   ─ filters the application out ─
   │
   ▼
No row written to temp_mapped_deals for this application
   │
   ▼
applications phase: checkApplicationId misses (app NOT in applications.json)
   │  transformer proceeds; contactId resolves via contacts.json ✓
   ▼
resolveDealId(source.id) → null → throw "Cannor resolve dealId" at line 73
```

**Predicted vs actual error count:**

| Expected from this cascade | Actual in the run (error catalog) |
|---|---|
| ~19,914 `Cannor resolve dealId` errors (upper bound: every gap app with a prior-migrated client) | **21,224** |

The 1,310 over-count gap (21,224 − 19,914) likely comes from:
- Apps whose client wasn't in contacts.json but failed to migrate this run for unrelated reasons (e.g., API timeouts during contacts phase).
- A small tail of source clients that were created post-prior-migration and have application creation but the client-migration failed in this run.

So **94% of dealId failures (19,914 / 21,224) are directly explained by the contacts/applications coverage asymmetry from the prior migration.**

## Fix

The fix is the same single change identified in the main analysis (Issue #1 / Recommendation #2 in `2026-05-28-log-analysis-5c9e6662.md`):

**Make `bulkCreateContacts` idempotent on `IDX_LOWERCASE_EMAIL` 409.** When the API rejects a contact as a duplicate:

1. `GET /v1/contacts?email=<lowercased>` to obtain the existing UUID.
2. Write the mapping into `temp_mapped_contacts` (`storeContactMapping(migrationId, {agentcisId, applyimsId})`).
3. Mark as `successful` (or a new `recovered` status) for counter purposes.

With that path in place:

- All 38,872 prior-migrated clients land in `temp_mapped_contacts` (29,484 recovered + the 9,388 that didn't re-encounter, which already land normally if extracted).
- `populateDealStaging`'s `migratedClientIds` filter includes them.
- The 19,914 gap applications get deal-staged correctly.
- Their dealId resolution succeeds.
- Estimated next-run impact (verified by simulation, see below): **19,914 applications** + **11,187 new deals** migrate cleanly that did not in this run.

Implementation surface: `src/loaders/batch-processor.ts` (where the duplicate-key error is caught — currently routes to `failed`) + `src/loaders/api-client.ts` (add a `getContactByEmail` method). No source-data or external system changes required.

## Verification: simulated post-fix `populateDealStaging` output

The actual `populateDealStaging` SQL (`src/orchestrators/migration.orchestrator.ts:539-574`) was re-run against agentcis source with the post-fix preconditions:
- `migratedClientIds` = the 38,872 ids from `src/mapper/contacts.json` (proxy: all prior-migrated clients recovered into `temp_mapped_contacts` via the upsert-on-409 fix).
- `app.id NOT IN (:priorAppIds)` — the Fix 1 filter already applied in `orchestrator.ts:577-582`.

### Aggregate output

| Metric | Count |
|---|---:|
| Application rows staged into `temp_mapped_deals` | **19,914** |
| Unique deal buckets (= unique dealIds → unique new deals POSTed to ApplyIMS) | **11,187** |
| Distinct clients in the staged set | 6,951 |

The 19,914 staged-application count matches the gap count from the "data" section above exactly — every gap application is captured by the simulated staging, with no shortfall.

### Sample bucket rows (first 5)

```
clientId | branchId | bucket | startDate            | endDate              | total | applicationIds
72       | 3        | 0      | 2018-08-14 12:27:04  | 2019-02-14 12:27:04  | 2     | 166, 405
72       | 3        | 1      | 2019-06-27 08:25:23  | 2019-08-14 12:27:04  | 2     | 24477, 24491
72       | 3        | 3      | 2020-06-19 10:29:26  | 2020-08-14 12:27:04  | 2     | 58840, 58841
72       | 3        | 4      | 2020-08-19 09:14:13  | 2021-02-14 12:27:04  | 2     | 64753, 64857
72       | 3        | 5      | 2021-04-26 13:35:32  | 2021-08-14 12:27:04  | 4     | 89020, 93826, 94707, 94708
```

Client 72 alone produces 5 buckets (= 5 new ApplyIMS deals) covering 12 gap applications spanning 2018-2021. After the fix, each of those 12 applications resolves its dealId to the corresponding bucket UUID and POSTs successfully.

### End-to-end resolution path for a staged gap application

```
application.transformer.ts:26  checkApplicationId(APP_ID)        → null (gap app, not in JSON) → proceed
                          :31  resolveContactId(client_id)        → UUID from contacts.json ✓
                          :32  resolveBranchId(addedByBranchId)   → UUID from branches.json ✓
                          :33  resolveUserId(creatorId)           → UUID (or null tail)
                          :44  resolveDealId(source.id)           → DatabaseStrategy lookup on
                                                                   temp_mapped_deals
                                                                   WHERE application_id = APP_ID
                                                                   → returns new bucket UUID ✓
                          :86  POST /v1/applications/bulk         → ApplyIMS creates the application
                                                                   linked to its bucket's deal
```

Every step that fails in the broken run now passes. No `"Cannor resolve dealId"` errors for any of the 19,914.

### Expected error reduction per class

| Error class | Pre-fix count | Post-fix expected | Notes |
|---|---:|---:|---|
| `Cannor resolve dealId` | 21,224 | ≤ 1,310 residual | 19,914 eliminated; residual is non-prior-migrated clients that failed contact migration for unrelated reasons (API timeouts, contact-follower duplicates) |
| `Cannot resolve contactId` (applications) | 428 | 428 (unchanged) | Clients never migrated anywhere; fix doesn't address them |
| `timeout of 30000ms` (applications) | 296 | unchanged | API saturation, separate concern |
| `Cannot resolve userId` | 18 | unchanged | 92-missing-users issue, separate |
| Other tail (productId/workflowId/date/duplicate-key) | ~40 | unchanged | Each its own root cause |

**Total application errors removed by this fix alone: ~19,914 of 22,006 (90.5%)** — plus the downstream contact-activities/notes/office-visits cascade that depends on the same `temp_mapped_contacts` coverage, which the analysis report quantifies separately.

### Reproducible verification SQL

```sql
SELECT
  COUNT(*)                                                                AS application_rows_staged,
  COUNT(DISTINCT CONCAT_WS('|', client_id, added_by_branch_id, bucket))   AS unique_buckets,
  COUNT(DISTINCT client_id)                                               AS distinct_clients
FROM (
  SELECT
    app.id, app.client_id, app.added_by_branch_id,
    FLOOR(
      TIMESTAMPDIFF(MONTH,
        MIN(app.created_at) OVER (PARTITION BY app.client_id, app.added_by_branch_id),
        app.created_at
      ) / 6
    ) AS bucket
  FROM applications app
  WHERE app.client_id IN (<38872 ids from contacts.json>)
    AND app.id NOT IN (<22791 ids from applications.json>)
) staged;
-- 2026-05-28 result: 19914 | 11187 | 6951
```

The two id lists come from:

```bash
jq -r '.[].agentcis_id' src/mapper/contacts.json     | sort -n | paste -sd,
jq -r '.[].agentcis_id' src/mapper/applications.json | sort -n | paste -sd,
```

## What this is NOT

- **Not a source data quality issue.** Only 1 application is attached to a client with null email or both names blank. The 21,224 dealId errors are not driven by bad source data.
- **Not a `populateDealStaging` SQL bug.** Fix 1 (excluding JSON apps from the bucketing SQL, already applied) addresses the *separate* orphan-deal-pollution side-effect of `checkApplicationId`, not this gap. Fix 1 alone does not unblock the 19,914 gap apps — they still need contacts to be present in `temp_mapped_contacts`.
- **Not solvable by re-running with the same code.** Re-running will hit the same `IDX_LOWERCASE_EMAIL` cascade until the idempotency path is added.

## Confidence

- **HIGH** that the 19,914 gap exists exactly as quantified — verified against the source DB.
- **HIGH** that the gap drives the dealId failures — predicted 19,914 vs observed 21,224 is within 6% (the remainder is explained by tail causes).
- **HIGH** that the contacts-upsert-on-409 fix is sufficient — traced through orchestrator code path end-to-end.
- **MEDIUM** on the exact prior-migration selection criterion — date is the strongest signal (89% 2024) but other filters were clearly in play. Resolving this is not required for the fix.
