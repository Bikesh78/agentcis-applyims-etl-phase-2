import { readFileSync, writeFileSync } from 'node:fs';

interface StageMapping {
  agentcis_id: number;
  applyims_id: string;
  service_stage_name: string;
}

const REQUIRED_COLUMNS = ['id', 'applyims_stage_id', 'stage'] as const;

function parseCsv(content: string): { header: string[]; rows: string[][] } {
  const lines = content.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) {
    throw new Error('CSV is empty');
  }
  const header = lines[0].split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((line) => line.split(','));
  return { header, rows };
}

function resolveColumnIndices(header: string[]): Record<(typeof REQUIRED_COLUMNS)[number], number> {
  const indices = {} as Record<(typeof REQUIRED_COLUMNS)[number], number>;
  const missing: string[] = [];
  for (const col of REQUIRED_COLUMNS) {
    const idx = header.indexOf(col);
    if (idx === -1) {
      missing.push(col);
    } else {
      indices[col] = idx;
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing required CSV column(s): ${missing.join(', ')}`);
  }
  return indices;
}

function convert(inputPath: string, outputPath: string): void {
  const content = readFileSync(inputPath, 'utf8');
  const { header, rows } = parseCsv(content);
  const idx = resolveColumnIndices(header);

  const out: StageMapping[] = [];
  rows.forEach((cells, i) => {
    const lineNumber = i + 2;
    const idCell = (cells[idx.id] ?? '').trim();
    const applyimsCell = (cells[idx.applyims_stage_id] ?? '').trim();
    const stageCell = (cells[idx.stage] ?? '').trim();

    if (!idCell) {
      process.stderr.write(`skip line ${lineNumber}: missing id\n`);
      return;
    }

    const agentcisId = Number(idCell);
    if (!Number.isFinite(agentcisId)) {
      throw new Error(`line ${lineNumber}: id "${idCell}" is not a number`);
    }

    out.push({
      agentcis_id: agentcisId,
      applyims_id: applyimsCell,
      service_stage_name: stageCell,
    });
  });

  writeFileSync(outputPath, JSON.stringify(out, null, 2) + '\n');
  process.stdout.write(`converted ${out.length} rows -> ${outputPath}\n`);
}

function main(): void {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    process.stderr.write('usage: tsx scripts/convert-stages-csv.ts <input.csv> <output.json>\n');
    process.exit(1);
  }
  convert(inputPath, outputPath);
}

main();
