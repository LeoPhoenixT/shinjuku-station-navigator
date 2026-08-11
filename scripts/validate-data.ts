import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMainModule } from './data/is-main-module.js';

const INPUT = 'public/data/processed/jr-shinjuku-ticket-gates-b1.json';
const OUTPUT = 'reports/processed-data-validation.json';

interface ValidationReport { input: string; valid: boolean; errors: string[]; warnings: string[]; summary: { featureCount: number; layerCount: number; usesMeters: boolean; rawShapefilesInPublic: boolean; bounds: unknown } }

export function validateProcessedData(input = INPUT, output = OUTPUT, inputLabel = input): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!existsSync(input)) errors.push(`Missing processed dataset: ${input}`);
  const data = errors.length === 0 ? JSON.parse(readFileSync(input, 'utf8')) : {};
  if (data.coordinateSystem?.units !== 'meters') errors.push('Processed data units must be meters.');
  if (data.coordinateSystem?.axes?.x !== 'east' || data.coordinateSystem?.axes?.y !== 'vertical' || data.coordinateSystem?.axes?.z !== 'south') errors.push('Unexpected scene axes.');
  if (!Array.isArray(data.features) || data.features.length === 0) errors.push('Processed data contains no features.');
  const ids = new Set<string>();
  for (const feature of data.features ?? []) {
    if (typeof feature.id !== 'string' || feature.id.length === 0) errors.push('Feature without stable id.');
    if (ids.has(feature.id)) errors.push(`Duplicate feature id: ${feature.id}`);
    ids.add(feature.id);
    if (typeof feature.sourceId !== 'string' || feature.sourceId.length === 0) errors.push(`Feature ${feature.id} is missing sourceId.`);
  }
  const publicRaw = existsSync('public') && hasRawShapefile('public');
  if (publicRaw) errors.push('Raw shapefile files must not be placed under public/.');
  const bounds = data.statistics?.bounds;
  for (const key of ['minX', 'maxX', 'minZ', 'maxZ']) if (typeof bounds?.[key] !== 'number' || !Number.isFinite(bounds[key])) errors.push(`Invalid coordinate bound ${key}.`);
  if (bounds && (Math.abs(bounds.minX) > 2000 || Math.abs(bounds.maxX) > 2000 || Math.abs(bounds.minZ) > 2000 || Math.abs(bounds.maxZ) > 2000)) warnings.push('Coordinate bounds are larger than expected for the selected station slice.');
  const report = { input: inputLabel, valid: errors.length === 0, errors, warnings, summary: { featureCount: data.features?.length ?? 0, layerCount: Object.keys(data.layers ?? {}).length, usesMeters: data.coordinateSystem?.units === 'meters', rawShapefilesInPublic: publicRaw, bounds } };
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  if (!report.valid) process.exitCode = 1;
  return report;
}

function hasRawShapefile(dir: string): boolean {
  return readdirSync(dir, { withFileTypes: true }).some((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? hasRawShapefile(full) : ['.shp', '.shx', '.dbf', '.prj'].includes(path.extname(entry.name).toLowerCase());
  });
}

if (isMainModule(import.meta.url)) {
  const report = validateProcessedData(process.argv[2] ?? INPUT, process.argv[3] ?? OUTPUT);
  console.log(`${report.valid ? 'Valid' : 'Invalid'} processed data: ${report.summary.featureCount} features across ${report.summary.layerCount} layers.`);
}
