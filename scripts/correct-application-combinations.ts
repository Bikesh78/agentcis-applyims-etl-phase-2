/*
 * Correct institution / branch / product / workflow on applications already migrated to
 * the ApplyIMS target (crm_client_applications). These were written with single-key
 * resolution, which returned wrong-context UUIDs (see CombinationResolver / the composite
 * mapper). A plain re-run won't fix them — the transformer skips existing applications —
 * so this recomputes the context-correct tuple from src/mapper/institutionPartnerProducts.json
 * (keyed by the source 4-key) and UPDATEs rows whose values differ.
 *
 * Dry-run by default (reports what would change). Pass --apply to write.
 *
 * Source 4-key comes from agentcis: products.vendor_id, applications.vendor_branch_id,
 * applications.product_id, applications.service_id, joined to the target via
 * crm_client_applications.agentcis_application_id.
 *
 * Target connection (the real migrated DB is prod_migration on :1569, NOT the .env DB_*
 * which points at an empty dev instance) via env, defaulting to the known values:
 *   TARGET_DB_HOST=localhost TARGET_DB_PORT=1569 TARGET_DB_USER=postgres
 *   TARGET_DB_PASSWORD=admin TARGET_DB_NAME=prod_migration
 *
 * Usage:
 *   tsx scripts/correct-application-combinations.ts            # dry run
 *   tsx scripts/correct-application-combinations.ts --apply    # write changes
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';
import { Client } from 'pg';
import { createAgentcisConnectionOptions } from '../src/configs/database.config.js';

interface CombinationEntry {
  agentcis_vendor_id: number;
  agentcis_vendor_branch_id: number;
  agentcis_product_id: number;
  agentcis_service_id: number;
  applyims_institution_id: string;
  applyims_institution_branch_id: string;
  applyims_product_id: string;
  applyims_workflow_id: string;
}

function loadCombinationMap(): Map<string, CombinationEntry> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const jsonPath = path.resolve(here, '../src/mapper/institutionPartnerProducts.json');
  const entries: CombinationEntry[] = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const map = new Map<string, CombinationEntry>();
  for (const e of entries) {
    map.set(
      `${e.agentcis_vendor_id}|${e.agentcis_vendor_branch_id}|${e.agentcis_product_id}|${e.agentcis_service_id}`,
      e
    );
  }
  return map;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const combo = loadCombinationMap();
  console.log(`Loaded ${combo.size} composite mappings`);

  // Source 4-key per agentcis application.
  const agentcisDb = new DataSource(createAgentcisConnectionOptions());
  await agentcisDb.initialize();
  const srcRows: Array<{
    id: number;
    vendor_id: number;
    vendor_branch_id: number;
    product_id: number;
    service_id: number;
  }> = await agentcisDb.query(
    `SELECT a.id, p.vendor_id, a.vendor_branch_id, a.product_id, a.service_id
       FROM applications a JOIN products p ON p.id = a.product_id`
  );
  await agentcisDb.destroy();
  const srcByApp = new Map<number, (typeof srcRows)[number]>();
  for (const r of srcRows) srcByApp.set(r.id, r);
  console.log(`Loaded ${srcByApp.size} source applications`);

  const target = new Client({
    host: process.env.TARGET_DB_HOST ?? 'localhost',
    port: Number(process.env.TARGET_DB_PORT ?? 1569),
    user: process.env.TARGET_DB_USER ?? 'postgres',
    password: process.env.TARGET_DB_PASSWORD ?? 'admin',
    database: process.env.TARGET_DB_NAME ?? 'prod_migration',
  });
  await target.connect();

  const migrated: Array<{
    id: string;
    agentcis_application_id: number;
    institution_id: string | null;
    institution_branch_id: string | null;
    product_id: string | null;
    workflow_id: string | null;
  }> = (
    await target.query(
      `SELECT id, agentcis_application_id, institution_id, institution_branch_id, product_id, workflow_id
         FROM crm_client_applications WHERE agentcis_application_id IS NOT NULL`
    )
  ).rows;
  console.log(`Loaded ${migrated.length} migrated applications`);

  let toFix = 0;
  let noMapping = 0;
  let applied = 0;
  let skippedDuplicate = 0;
  let otherErrors = 0;
  const collisions: Array<{
    id: string;
    agentcis_application_id: number;
    institution_id: string | null;
    institution_branch_id: string | null;
    product_id: string | null;
    workflow_id: string | null;
  }> = [];

  for (const row of migrated) {
    const src = srcByApp.get(row.agentcis_application_id);
    if (!src) continue;
    const c = combo.get(
      `${src.vendor_id}|${src.vendor_branch_id}|${src.product_id}|${src.service_id}`
    );
    if (!c) {
      noMapping += 1;
      continue;
    }
    // Only correct fields the composite mapper actually provides.
    const next = {
      institution_id: c.applyims_institution_id || row.institution_id,
      institution_branch_id: c.applyims_institution_branch_id || row.institution_branch_id,
      product_id: c.applyims_product_id || row.product_id,
      workflow_id: c.applyims_workflow_id || row.workflow_id,
    };
    const changed =
      next.institution_id !== row.institution_id ||
      next.institution_branch_id !== row.institution_branch_id ||
      next.product_id !== row.product_id ||
      next.workflow_id !== row.workflow_id;
    if (!changed) continue;
    toFix += 1;

    if (apply) {
      try {
        await target.query(
          `UPDATE crm_client_applications
              SET institution_id=$1, institution_branch_id=$2, product_id=$3, workflow_id=$4, updated_at=now()
            WHERE id=$5`,
          [
            next.institution_id,
            next.institution_branch_id,
            next.product_id,
            next.workflow_id,
            row.id,
          ]
        );
        applied += 1;
        if (applied % 5000 === 0) console.log(`  updated ${applied}/${toFix}`);
      } catch (err) {
        // application_uniq_idx: correcting two wrong combos to the same right combo for
        // one contact collides. These are duplicate In-Progress applications — skip and
        // record for the migration team to review/dedupe; don't abort the whole run.
        const code = (err as { code?: string }).code;
        if (code === '23505') {
          skippedDuplicate += 1;
          collisions.push({
            id: row.id,
            agentcis_application_id: row.agentcis_application_id,
            institution_id: next.institution_id,
            institution_branch_id: next.institution_branch_id,
            product_id: next.product_id,
            workflow_id: next.workflow_id,
          });
        } else {
          otherErrors += 1;
          console.error(
            `  row ${row.id} (agentcis ${row.agentcis_application_id}) failed [${code}]: ${err}`
          );
        }
      }
    }
  }

  await target.end();

  if (collisions.length > 0) {
    const csv =
      'applyims_id,agentcis_application_id,institution_id,institution_branch_id,product_id,workflow_id\n' +
      collisions
        .map(
          (c) =>
            `${c.id},${c.agentcis_application_id},${c.institution_id},${c.institution_branch_id},${c.product_id},${c.workflow_id}`
        )
        .join('\n') +
      '\n';
    writeFileSync('duplicate-application-collisions.csv', csv);
  }

  console.log(
    `\nApplications needing correction: ${toFix}` +
      `\n  no composite mapping (left unchanged): ${noMapping}` +
      (apply
        ? `\n  rows updated: ${applied}` +
          `\n  skipped (duplicate combo, In-Progress unique index): ${skippedDuplicate}` +
          (skippedDuplicate > 0
            ? ` — written to duplicate-application-collisions.csv for review`
            : '') +
          `\n  other errors (logged, skipped): ${otherErrors}`
        : `\n  DRY RUN — re-run with --apply to write`)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
