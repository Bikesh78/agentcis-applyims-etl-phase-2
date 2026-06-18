/*
 * Build src/mapper/institutionPartnerProducts.json from the master mapper
 * "Data Migration Phase 2 Mappers - Institution_Partner_Products.csv".
 *
 * Why: application.transformer resolved product / workflow / institution-branch with
 * INDEPENDENT single-key lookups (products.json etc.). A single agentcis id maps to
 * multiple applyims UUIDs depending on the full (vendor, branch, product, service)
 * tuple, so single-key lookups returned the wrong UUID for the application's context,
 * producing (product@branch) / (workflow@institution) pairs absent from the catalogue.
 * This composite mapper lets the resolver pick the context-correct tuple.
 *
 * Within each 4-key, institution / branch / workflow are unique. Product is ambiguous
 * for ~2,065 keys (duplicate product records). We disambiguate by catalogue membership:
 * prefer the candidate present in product_institution_branches for the resolved branch.
 * That set is supplied as a PIB export so this script needs no DB connection.
 *
 * Prerequisite — export the catalogue once (real target is prod_migration on :1569):
 *   PGPASSWORD=admin psql -h localhost -p 1569 -U postgres -d prod_migration -t -A \
 *     -c "SELECT product_id||'|'||institution_branch_id FROM product_institution_branches" > pib.txt
 *
 * Usage:
 *   tsx scripts/build-institution-partner-products.ts \
 *     "Data Migration Phase 2 Mappers - Institution_Partner_Products.csv" \
 *     pib.txt \
 *     src/mapper/institutionPartnerProducts.json
 */
import { readFileSync, writeFileSync } from 'node:fs';

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

// Column indices in the master CSV header.
const COL = {
  vendor: 0,
  vendorBranch: 1,
  product: 2,
  service: 3,
  applyimsService: 4,
  applyimsWorkflowType: 5,
  applyimsWorkflow: 6,
  applyimsInstitution: 7,
  applyimsInstitutionBranch: 8,
  applyimsProduct: 9,
} as const;

interface Candidate {
  vendor: number;
  vendorBranch: number;
  product: number;
  service: number;
  institution: string;
  branch: string;
  workflow: string;
  applyimsProduct: string;
}

function loadMaster(path: string): Candidate[] {
  const lines = readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.length > 0);
  const rows = lines.slice(1); // drop header
  return rows.map((line) => {
    const c = line.split(',').map((x) => x.trim());
    return {
      vendor: Number(c[COL.vendor]),
      vendorBranch: Number(c[COL.vendorBranch]),
      product: Number(c[COL.product]),
      service: Number(c[COL.service]),
      institution: c[COL.applyimsInstitution],
      branch: c[COL.applyimsInstitutionBranch],
      workflow: c[COL.applyimsWorkflow],
      applyimsProduct: c[COL.applyimsProduct],
    };
  });
}

function build(masterPath: string, pibPath: string, outPath: string): void {
  const candidates = loadMaster(masterPath);
  const pib = new Set(
    readFileSync(pibPath, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
  );

  // Group candidate rows by the agentcis 4-key.
  const groups = new Map<string, Candidate[]>();
  for (const cand of candidates) {
    if (
      !Number.isFinite(cand.vendor) ||
      !Number.isFinite(cand.vendorBranch) ||
      !Number.isFinite(cand.product) ||
      !Number.isFinite(cand.service)
    ) {
      continue;
    }
    const key = `${cand.vendor}|${cand.vendorBranch}|${cand.product}|${cand.service}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(cand);
  }

  const out: CombinationEntry[] = [];
  let productAmbiguous = 0;
  let resolvedByCatalogue = 0;
  let catalogueGaps = 0;

  for (const [, rows] of groups) {
    const first = rows[0];
    const products = [...new Set(rows.map((r) => r.applyimsProduct))];

    let chosenProduct = products[0];
    if (products.length > 1) {
      productAmbiguous += 1;
      const catalogued = products.filter((p) => pib.has(`${p}|${first.branch}`));
      if (catalogued.length >= 1) {
        chosenProduct = catalogued[0];
        if (catalogued.length === 1) resolvedByCatalogue += 1;
      } else {
        catalogueGaps += 1; // no candidate catalogued at this branch — left as-is for review
      }
    }

    out.push({
      agentcis_vendor_id: first.vendor,
      agentcis_vendor_branch_id: first.vendorBranch,
      agentcis_product_id: first.product,
      agentcis_service_id: first.service,
      applyims_institution_id: first.institution,
      applyims_institution_branch_id: first.branch,
      applyims_product_id: chosenProduct,
      applyims_workflow_id: first.workflow,
    });
  }

  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  process.stdout.write(
    `built ${out.length} composite entries -> ${outPath}\n` +
      `  product-ambiguous keys: ${productAmbiguous}` +
      ` (catalogue-resolved: ${resolvedByCatalogue}, gaps left as-is: ${catalogueGaps})\n`
  );
}

function main(): void {
  const [, , masterPath, pibPath, outPath] = process.argv;
  if (!masterPath || !pibPath || !outPath) {
    process.stderr.write(
      'usage: tsx scripts/build-institution-partner-products.ts <master.csv> <pib.txt> <out.json>\n'
    );
    process.exit(1);
  }
  build(masterPath, pibPath, outPath);
}

main();
