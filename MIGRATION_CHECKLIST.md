# Production Migration Checklist

## Pre-Migration

### Configuration
- [ ] `config/production.json` has valid JSON (no trailing commas)
- [ ] `APPLYIMS_API_TIMEOUT` env var set to `120000` (120s)
- [ ] All required env vars present: `AGENTCIS_DB_*`, `ETL_DB_*`, `APPLYIMS_*`, `TENANT_*`, `MIGRATION_ADMIN_USER_ID`
- [ ] `NODE_ENV=production` is set

### Mapper files
- [ ] `contacts.json` — no duplicate `agentcis_id`, all `applyims_id` are valid UUIDs
- [ ] `applications.json` — same checks
- [ ] `products.json` — no invalid UUIDs (e.g. product name strings), no `agentcis_id` mapping to multiple different `applyims_id`
- [ ] `users.json` — UUIDs exist in ApplyIMS (stale UUIDs cause FK violations downstream)
- [ ] `workflowStages.json` — all stage UUIDs exist in ApplyIMS `crm_workflow_stages`

### Source data (agentcis MySQL)
- [ ] `country_of_passport` — no raw integer values (run `COUNTRIES_MAPS` fix before migrating)

### ETL DB state
- [ ] ETL tracking DB is clean for a fresh run, or intentionally resuming from a prior run
- [ ] `temp_mapped_*` tables are clear if starting fresh
- [ ] No stale `in_progress` jobs from prior runs — stale UUIDs in `temp_mapped_users` cause downstream FK failures
- [ ] Take DB dump before starting:
  ```bash
  docker exec <container> pg_dump -U postgres etl_tracking_dev_new > dump_$(date +%Y%m%d).sql
  ```

---

## During Migration

### Entity order (strict)
```
users → agents → contacts → deals → applications → notes → contact-activities → office-visits → checkins → attachments
```

### After contacts phase
- [ ] Verify `populateDealStaging` ran — check `temp_mapped_deals` row count
- [ ] If prior-migrated contacts exist, run backfill script first:
  ```bash
  npx tsx scripts/backfill-duplicate-email-mappings.ts <migrationId>
  ```

### Monitor
- [ ] Watch for `timeout` errors — reduce batch size if frequent
- [ ] Watch for `ENOTFOUND` errors — network issue, retry after connectivity restored

---

## Post-Migration Verification

### Checkpoint summary
```sql
SELECT entity_type, total_count, success_count, failed_count,
  ROUND(success_count::numeric/NULLIF(total_count,0)*100,1) as success_pct
FROM migration_checkpoints
WHERE migration_id = '<migrationId>'
ORDER BY CASE entity_type
  WHEN 'users' THEN 1 WHEN 'agents' THEN 2 WHEN 'contacts' THEN 3
  WHEN 'deals' THEN 4 WHEN 'applications' THEN 5 WHEN 'notes' THEN 6
  WHEN 'contact-activities' THEN 7 WHEN 'office-visits' THEN 8
  WHEN 'checkins' THEN 9 WHEN 'attachments' THEN 10 ELSE 11 END;
```

### Application coverage
```sql
SELECT COUNT(*) as etl_mapped FROM temp_mapped_applications;
```

### app_identifier — must be 0 before running contact-activities
```sql
SELECT COUNT(*) FROM temp_mapped_applications WHERE app_identifier IS NULL;
```
If nulls exist after chunk retry, backfill from ApplyIMS:
```sql
UPDATE temp_mapped_applications tma
SET app_identifier = ca.app_identifier
FROM crm_client_applications ca
WHERE ca.id = tma.applyims_application_id
  AND tma.app_identifier IS NULL;
```

### Error breakdown
```sql
SELECT entity_type,
  REGEXP_REPLACE(error_message, '\d{4,}', 'N', 'g') as pattern,
  COUNT(*) as cnt
FROM migration_errors
WHERE migration_id = '<migrationId>'
GROUP BY entity_type, pattern
ORDER BY entity_type, cnt DESC;
```

---

## Retry Strategy

Run in dependency order:

```bash
# Contacts
POST /api/migration/<id>/retry {"entityTypes": ["contacts"]}

# Deals (after contacts)
POST /api/migration/<id>/retry {"entityTypes": ["deals"]}

# Applications
POST /api/migration/<id>/retry {"entityTypes": ["applications"]}

# Notes (after applications)
POST /api/migration/<id>/retry {"entityTypes": ["notes"]}

# Contact-activities (only after app_identifier null count = 0)
POST /api/migration/<id>/retry {"entityTypes": ["contact-activities"]}

# Office-visits, checkins, attachments
POST /api/migration/<id>/retry {"entityTypes": ["office-visits", "checkins", "attachments"]}
```

### Before retrying contact-activities
- [ ] `app_identifier` null count = 0 in `temp_mapped_applications`
- [ ] `activitiesTypeId` mapper is up to date (`src/mapper/interestedServices.json`)

### Permanent failures (not retryable)
- Contacts with null or invalid email
- Applications whose contact has null email
- Notes linked to those contacts/applications
- Office-visits with user IDs not in `users.json` or `temp_mapped_users`
- Attachments with unsupported types: `email`, `document_checklist`, `task`, `partner`

---

## Final Sign-off
- [ ] Total applications in ApplyIMS matches expected count
- [ ] `app_identifier` null count = 0
- [ ] ETL DB dump taken after successful migration
- [ ] Temporary tables (`null_app`, etc.) cleaned up from ETL DB
