/*
 * Backfill temp_mapped_contacts for a migration run whose contacts phase failed
 * with IDX_LOWERCASE_EMAIL duplicates. Two modes:
 *
 *   --from-json     (default) — copy every src/mapper/contacts.json entry into
 *                   temp_mapped_contacts for the target migrationId. Fast, no API
 *                   calls. Covers the 38,872 prior-migrated clients for this run.
 *
 *   --via-api       opt-in — for clients in migration_errors with an
 *                   IDX_LOWERCASE_EMAIL failure that are NOT in contacts.json,
 *                   GET each by email via the ApplyIMS API and write the mapping.
 *                   Covers the long tail of "same email but different agentcis_id"
 *                   and contacts created in ApplyIMS outside this codebase.
 *
 * After running, the affected migration can be resumed from populateDealStaging
 * (which reads temp_mapped_contacts) without re-running the contacts phase.
 *
 * Usage:
 *   npx tsx scripts/backfill-duplicate-email-mappings.ts <migrationId> [--via-api]
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';
import pLimit from 'p-limit';
import config from 'config';
import {
  createAgentcisConnectionOptions,
  createEtlConnectionOptions,
} from '../src/configs/database.config.js';
import { TempMappedContact } from '../src/entities/etlDb/temp-mapped-contacts.entity.js';
import { ApplyIMSApiClient } from '../src/loaders/api-client.js';
import { apiConfigSchema } from '../src/configs/api.config.js';
import { logger } from '../src/utils/logger.js';

async function main(): Promise<void> {
  const [migrationId, ...flags] = process.argv.slice(2);
  if (!migrationId) {
    console.error(
      'Usage: tsx scripts/backfill-duplicate-email-mappings.ts <migrationId> [--via-api]'
    );
    process.exit(1);
  }
  const viaApi = flags.includes('--via-api');

  const here = path.dirname(fileURLToPath(import.meta.url));
  const jsonPath = path.resolve(here, '../src/mapper/contacts.json');
  const contactsJson: Array<{ agentcis_id: number; applyims_id: string }> = JSON.parse(
    await readFile(jsonPath, 'utf-8')
  );
  console.log(`Loaded ${contactsJson.length} mappings from contacts.json`);

  const etlDb = new DataSource(createEtlConnectionOptions());
  await etlDb.initialize();

  let recoveredFromJson = 0;
  try {
    const rows = contactsJson
      .filter(
        (c) =>
          Number.isFinite(c.agentcis_id) &&
          typeof c.applyims_id === 'string' &&
          c.applyims_id.length > 0
      )
      .map((c) => ({
        agentcisContactId: c.agentcis_id,
        applyimsContactId: c.applyims_id,
        migrationId,
      }));

    const repo = etlDb.getRepository(TempMappedContact);
    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const slice = rows.slice(i, i + batchSize);
      await repo.upsert(slice, {
        conflictPaths: ['agentcisContactId'],
        skipUpdateIfNoValuesChanged: true,
      });
      recoveredFromJson += slice.length;
      if (i % (batchSize * 10) === 0) {
        console.log(`  upserted ${recoveredFromJson}/${rows.length}`);
      }
    }
    console.log(
      `From-JSON pass complete: ${recoveredFromJson} rows upserted into temp_mapped_contacts`
    );
  } finally {
    if (!viaApi) {
      await etlDb.destroy();
      return;
    }
  }

  // --via-api: pick up clients still missing — those that failed with an
  // IDX_LOWERCASE_EMAIL error in migration_errors AND aren't covered by the JSON.
  const agentcisDb = new DataSource(createAgentcisConnectionOptions());
  await agentcisDb.initialize();

  const apiConfig = apiConfigSchema.validate(config.get('applyimsApi')).value;
  if (!apiConfig) {
    throw new Error('Invalid api config; aborting --via-api pass');
  }
  const apiClient = new ApplyIMSApiClient(apiConfig, logger);
  await apiClient.authenticate();

  type ErrRow = { entityId: string };
  const errorRows: ErrRow[] = await etlDb.query(
    `SELECT entity_id AS "entityId"
     FROM migration_errors
     WHERE migration_id = $1
       AND entity_type = 'contacts'
       AND (error_message ILIKE '%IDX_LOWERCASE_EMAIL%'
            OR error_code  = 'DUPLICATE_EMAIL')`,
    [migrationId]
  );
  console.log(`migration_errors duplicate-email rows: ${errorRows.length}`);

  const jsonIds = new Set(contactsJson.map((c) => c.agentcis_id));
  const candidates = errorRows
    .map((r) => Number(r.entityId))
    .filter((id) => Number.isFinite(id) && !jsonIds.has(id));
  console.log(`Candidates not covered by contacts.json: ${candidates.length}`);

  if (candidates.length === 0) {
    await Promise.all([etlDb.destroy(), agentcisDb.destroy()]);
    return;
  }

  const clientRows: Array<{ id: number; email: string }> = await agentcisDb.query(
    `SELECT id, email FROM clients WHERE id IN (?)`,
    [candidates]
  );
  console.log(`Fetched ${clientRows.length} client emails from agentcis`);

  const limit = pLimit(10);
  const repo = etlDb.getRepository(TempMappedContact);
  let recovered = 0;
  let notFound = 0;
  await Promise.all(
    clientRows.map((c) =>
      limit(async () => {
        if (!c.email) {
          notFound += 1;
          return;
        }
        const existing = await apiClient.getContactByEmail(c.email);
        if (!existing) {
          notFound += 1;
          return;
        }
        await repo.upsert(
          {
            agentcisContactId: c.id,
            applyimsContactId: existing.id,
            migrationId,
          },
          { conflictPaths: ['agentcisContactId'], skipUpdateIfNoValuesChanged: true }
        );
        recovered += 1;
      })
    )
  );

  console.log(`Via-API pass complete: recovered=${recovered}, notFound=${notFound}`);
  await Promise.all([etlDb.destroy(), agentcisDb.destroy()]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
