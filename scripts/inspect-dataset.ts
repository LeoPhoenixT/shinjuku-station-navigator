import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMainModule, portablePath } from './data/is-main-module.js';

export interface CompanionStatus { extension: string; present: boolean; path?: string }
export interface DbfField { name: string; type: string; length: number; decimalCount: number }
export interface ShapefileGroup { baseName: string; directory: string; files: CompanionStatus[]; valid: boolean; geometryType?: string; featureCount?: number; bounds?: number[]; encoding: string; crs?: string; dbfFields: DbfField[]; warnings: string[]; checksum: string }
export interface InspectionReport { generatedAt: string; datasetRoot: string; summary: { groupCount: number; validGroupCount: number; missingCompanionCount: number; officialNodeLink: boolean; routingFeasibility: string }; groups: ShapefileGroup[]; facilities: string[]; floors: string[]; routingLayers: string[] }

const REQUIRED = ['.shp', '.shx', '.dbf', '.prj'];
const SHAPE_TYPES: Record<number, string> = { 0: 'NullShape', 1: 'Point', 3: 'PolyLine', 5: 'Polygon', 8: 'MultiPoint', 11: 'PointZ', 13: 'PolyLineZ', 15: 'PolygonZ', 18: 'MultiPointZ', 21: 'PointM', 23: 'PolyLineM', 25: 'PolygonM', 28: 'MultiPointM', 31: 'MultiPatch' };

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function readShapeHeader(shpPath: string): { geometryType: string; bounds: number[] } {
  const buffer = readFileSync(shpPath);
  if (buffer.byteLength < 100) throw new Error('SHP header is shorter than 100 bytes');
  const fileCode = buffer.readInt32BE(0);
  if (fileCode !== 9994) throw new Error(`Unexpected SHP file code ${fileCode}`);
  const shapeType = buffer.readInt32LE(32);
  return {
    geometryType: SHAPE_TYPES[shapeType] ?? `Unknown(${shapeType})`,
    bounds: [buffer.readDoubleLE(36), buffer.readDoubleLE(44), buffer.readDoubleLE(52), buffer.readDoubleLE(60)],
  };
}

function readDbfSchema(dbfPath: string): { fields: DbfField[]; count: number; warnings: string[] } {
  const warnings: string[] = [];
  const buffer = readFileSync(dbfPath);
  if (buffer.byteLength < 33) throw new Error('DBF header is shorter than 33 bytes');
  const count = buffer.readUInt32LE(4);
  const headerLength = buffer.readUInt16LE(8);
  const recordLength = buffer.readUInt16LE(10);
  if (headerLength > buffer.byteLength) throw new Error('DBF header length exceeds file size');
  if (recordLength === 0) warnings.push('DBF record length is zero');
  const fields: DbfField[] = [];
  for (let offset = 32; offset + 32 <= headerLength; offset += 32) {
    if (buffer[offset] === 0x0d) break;
    const rawName = buffer.subarray(offset, offset + 11);
    const nul = rawName.indexOf(0);
    const nameBytes = nul >= 0 ? rawName.subarray(0, nul) : rawName;
    const name = nameBytes.toString('latin1').trim();
    const type = String.fromCharCode(buffer[offset + 11]);
    fields.push({ name, type, length: buffer[offset + 16], decimalCount: buffer[offset + 17] });
  }
  const expectedSize = headerLength + count * recordLength + 1;
  if (expectedSize > buffer.byteLength) warnings.push(`DBF appears truncated: expected at least ${expectedSize} bytes, found ${buffer.byteLength}`);
  return { fields, count, warnings };
}

function detectEncoding(basePath: string): string {
  const cpg = `${basePath}.cpg`;
  if (existsSync(cpg)) return readFileSync(cpg, 'utf8').trim() || 'unknown-cpg-empty';
  return 'unspecified (DBF code page byte only)';
}

function inspectGroup(basePath: string, root: string): ShapefileGroup {
  const directory = portablePath(path.relative(root, path.dirname(basePath))) || '.';
  const baseName = path.basename(basePath);
  const files = REQUIRED.map((extension) => ({ extension, present: existsSync(`${basePath}${extension}`), path: existsSync(`${basePath}${extension}`) ? portablePath(path.relative(root, `${basePath}${extension}`)) : undefined }));
  if (existsSync(`${basePath}.cpg`)) files.push({ extension: '.cpg', present: true, path: portablePath(path.relative(root, `${basePath}.cpg`)) });
  const warnings: string[] = [];
  let geometryType: string | undefined;
  let bounds: number[] | undefined;
  let featureCount: number | undefined;
  let dbfFields: DbfField[] = [];
  let crs: string | undefined;
  try { ({ geometryType, bounds } = readShapeHeader(`${basePath}.shp`)); } catch (error) { warnings.push(`SHP read error: ${(error as Error).message}`); }
  if (existsSync(`${basePath}.dbf`)) {
    try { const dbf = readDbfSchema(`${basePath}.dbf`); featureCount = dbf.count; dbfFields = dbf.fields; warnings.push(...dbf.warnings); } catch (error) { warnings.push(`DBF read error: ${(error as Error).message}`); }
  }
  if (existsSync(`${basePath}.prj`)) crs = readFileSync(`${basePath}.prj`, 'utf8').trim();
  const checksum = existsSync(`${basePath}.shp`) ? sha256(`${basePath}.shp`) : '';
  return { baseName, directory, files, valid: files.filter((f) => REQUIRED.includes(f.extension)).every((f) => f.present), geometryType, featureCount, bounds, encoding: detectEncoding(basePath), crs, dbfFields, warnings, checksum };
}

export function inspectDataset(datasetRoot = 'shapefile', output = 'reports/dataset-inspection.json'): InspectionReport {
  const root = path.resolve(datasetRoot);
  const shpFiles = walk(root).filter((file) => path.extname(file).toLowerCase() === '.shp').sort();
  const groups = shpFiles.map((file) => inspectGroup(file.slice(0, -4), root));
  const floors = Array.from(new Set(groups.map((g) => path.basename(g.directory)).filter((name) => /^(B?\d+|\d+out)$/i.test(name)))).sort();
  const facilities = Array.from(new Set(groups.map((g) => g.directory.split('/').find((part) => /^\d+\./.test(part))).filter((name): name is string => Boolean(name)))).sort();
  const routingLayers = groups.filter((g) => /(^|[_-])(node|link)$/i.test(g.baseName) || g.directory.split('/').includes('nw')).map((g) => `${g.directory}/${g.baseName}`);
  const officialNodeLink = routingLayers.some((l) => /node/i.test(l)) && routingLayers.some((l) => /link/i.test(l));
  const report: InspectionReport = {
    generatedAt: new Date(0).toISOString(),
    datasetRoot: portablePath(path.relative(process.cwd(), root)) || '.',
    summary: { groupCount: groups.length, validGroupCount: groups.filter((g) => g.valid).length, missingCompanionCount: groups.flatMap((g) => g.files).filter((f) => !f.present).length, officialNodeLink, routingFeasibility: officialNodeLink ? 'Official Node/Link data confirmed' : 'Additional official resource required' },
    groups, facilities, floors, routingLayers,
  };
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (isMainModule(import.meta.url)) {
  const rootArg = process.argv[2] ?? 'shapefile';
  const outArg = process.argv[3] ?? 'reports/dataset-inspection.json';
  const report = inspectDataset(rootArg, outArg);
  console.log(`Inspected ${report.summary.groupCount} shapefile groups (${report.summary.validGroupCount} valid).`);
  console.log(`Routing feasibility: ${report.summary.routingFeasibility}`);
}
