import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { resolveIndoorMapCategory, type IndoorMapCategoryLayer } from '../src/data/indoorMapCategories.js';
import { readDbf, readShp, type ShapeGeometry } from './data/shapefile.js';
import { isMainModule, portablePath } from './data/is-main-module.js';

type Scalar = string | number | boolean;

export interface ValueCount { value: Scalar; count: number }
export interface FieldProfile {
  recordCount: number;
  nullCount: number;
  nullRate: number;
  distinctCount: number;
  values?: ValueCount[];
  sample?: Scalar[];
}

export interface LayerSemanticProfile {
  groupCount: number;
  featureCount: number;
  category: FieldProfile;
  name: FieldProfile;
}

export interface SemanticAuditRecord {
  layer: IndoorMapCategoryLayer;
  category: Scalar | null;
  name: Scalar | null;
  floor: string | null;
  sourceArea: string;
  sourceFile: string;
  sourceRecord: number;
  geometry: ShapeGeometry | null;
}

export interface CategoryAuditEntry {
  code: string;
  known: boolean;
  nameJa: string;
  nameEn: string;
  role: string;
  recordCount: number;
  namedCount: number;
  unnamedCount: number;
  geometryTypes: Record<string, number>;
  floors: Record<string, number>;
  sourceAreas: Record<string, number>;
  bounds: [number, number, number, number] | null;
  malformedRecordCount: number;
  examples: Array<{ sourceFile: string; sourceRecord: number; name: string | null; floor: string | null; sourceArea: string }>;
}

export interface LayerCategoryAudit {
  featureCount: number;
  categoryCount: number;
  missingCategoryCount: number;
  missingFloorCount: number;
  unknownCategoryCodes: string[];
  categories: CategoryAuditEntry[];
}

export interface MapSemanticsReport {
  generatedAt: string;
  sourceRoot: string;
  officialNetwork: {
    nodeCount: number;
    linkCount: number;
    nodeFields: Record<string, FieldProfile>;
    linkFields: Record<string, FieldProfile>;
  };
  visibleLayers: Record<string, LayerSemanticProfile>;
  categoryAudit: Record<IndoorMapCategoryLayer, LayerCategoryAudit>;
  interpretationStatus: Record<string, { status: 'structural' | 'confirmed-2018-mlit-spec' | 'requires-dataset-validation'; note: string }>;
}

const DEFAULT_ROOT = 'shapefile/新宿駅周辺屋内地図オープンデータ（Shapefile）';
const DEFAULT_OUTPUT = 'reports/map-semantics-profile.json';
const VISIBLE_LAYERS = ['Facility', 'Space', 'Fixture', 'Floor', 'Opening'] as const;
const AUDITED_LAYERS = ['Facility', 'Space', 'Fixture'] as const satisfies readonly IndoorMapCategoryLayer[];
const MAX_VALUES = 50;
const MAX_SAMPLE = 12;

function scalarKey(value: Scalar): string {
  return `${typeof value}:${String(value)}`;
}

export function profileValues(values: Array<Scalar | null>): FieldProfile {
  const counts = new Map<string, ValueCount>();
  for (const value of values) {
    if (value === null) continue;
    const key = scalarKey(value);
    const current = counts.get(key);
    if (current) current.count += 1;
    else counts.set(key, { value, count: 1 });
  }
  const ordered = [...counts.values()].sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
  const nullCount = values.filter((value) => value === null).length;
  const base: FieldProfile = {
    recordCount: values.length,
    nullCount,
    nullRate: values.length === 0 ? 0 : Number((nullCount / values.length).toFixed(6)),
    distinctCount: ordered.length,
  };
  if (ordered.length <= MAX_VALUES) return { ...base, values: ordered };
  return { ...base, sample: ordered.slice(0, MAX_SAMPLE).map(({ value }) => value) };
}

function profileRecords(records: Array<Record<string, Scalar | null>>): Record<string, FieldProfile> {
  const fields = Array.from(new Set(records.flatMap((record) => Object.keys(record)))).sort();
  return Object.fromEntries(fields.map((field) => [field, profileValues(records.map((record) => record[field] ?? null))]));
}

function dbfRecords(filePath: string): Array<Record<string, Scalar | null>> {
  return readDbf(filePath).map(({ properties }) => properties);
}

function walkDbf(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walkDbf(full) : path.extname(entry.name).toLowerCase() === '.dbf' ? [full] : [];
  });
}

function visibleLayerName(filePath: string): typeof VISIBLE_LAYERS[number] | undefined {
  return VISIBLE_LAYERS.find((layer) => path.basename(filePath, '.dbf').endsWith(`_${layer}`));
}

function scalarCounts(values: string[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b)));
}

function geometryPoints(geometry: ShapeGeometry | null): Array<[number, number]> {
  if (!geometry) return [];
  return geometry.type === 'Point' ? [geometry.coordinates] : geometry.parts.flat();
}

function recordName(value: Scalar | null): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function auditSemanticRecords(layer: IndoorMapCategoryLayer, records: SemanticAuditRecord[]): LayerCategoryAudit {
  const missingCategoryCount = records.filter(({ category }) => category === null || String(category).trim() === '').length;
  const grouped = new Map<string, SemanticAuditRecord[]>();
  for (const record of records) {
    const resolved = resolveIndoorMapCategory(layer, record.category);
    const code = resolved.code || '(missing)';
    const current = grouped.get(code);
    if (current) current.push(record);
    else grouped.set(code, [record]);
  }
  const categories = [...grouped].sort(([a], [b]) => a.localeCompare(b)).map<CategoryAuditEntry>(([code, categoryRecords]) => {
    const definition = resolveIndoorMapCategory(layer, code === '(missing)' ? '' : code);
    const points = categoryRecords.flatMap(({ geometry }) => geometryPoints(geometry));
    const bounds: CategoryAuditEntry['bounds'] = points.length === 0 ? null : [
      Math.min(...points.map(([x]) => x)),
      Math.min(...points.map(([, y]) => y)),
      Math.max(...points.map(([x]) => x)),
      Math.max(...points.map(([, y]) => y)),
    ];
    const namedCount = categoryRecords.filter(({ name }) => recordName(name) !== null).length;
    return {
      code,
      known: definition.known,
      nameJa: definition.nameJa,
      nameEn: definition.nameEn,
      role: definition.role,
      recordCount: categoryRecords.length,
      namedCount,
      unnamedCount: categoryRecords.length - namedCount,
      geometryTypes: scalarCounts(categoryRecords.map(({ geometry }) => geometry?.type ?? 'Null')),
      floors: scalarCounts(categoryRecords.map(({ floor }) => floor ?? '(missing)')),
      sourceAreas: scalarCounts(categoryRecords.map(({ sourceArea }) => sourceArea)),
      bounds,
      malformedRecordCount: categoryRecords.filter(({ geometry }) => geometry === null).length,
      examples: categoryRecords.slice().sort((a, b) => a.sourceFile.localeCompare(b.sourceFile) || a.sourceRecord - b.sourceRecord).slice(0, 5).map((record) => ({
        sourceFile: record.sourceFile,
        sourceRecord: record.sourceRecord,
        name: recordName(record.name),
        floor: record.floor,
        sourceArea: record.sourceArea,
      })),
    };
  });
  return {
    featureCount: records.length,
    categoryCount: categories.length,
    missingCategoryCount,
    missingFloorCount: records.filter(({ floor }) => floor === null).length,
    unknownCategoryCodes: categories.filter(({ known }) => !known).map(({ code }) => code),
    categories,
  };
}

export function profileMapSemantics(sourceRoot = DEFAULT_ROOT, output = DEFAULT_OUTPUT): MapSemanticsReport {
  const root = path.resolve(sourceRoot);
  const nodeRecords = dbfRecords(path.join(root, 'nw', 'Shinjuku_node.dbf'));
  const linkRecords = dbfRecords(path.join(root, 'nw', 'Shinjuku_link.dbf'));
  const visible = Object.fromEntries(VISIBLE_LAYERS.map((layer) => [layer, { groups: 0, records: [] as Array<Record<string, Scalar | null>> }])) as Record<typeof VISIBLE_LAYERS[number], { groups: number; records: Array<Record<string, Scalar | null>> }>;
  const semanticRecords = Object.fromEntries(AUDITED_LAYERS.map((layer) => [layer, [] as SemanticAuditRecord[]])) as Record<IndoorMapCategoryLayer, SemanticAuditRecord[]>;
  for (const file of walkDbf(root).sort()) {
    const layer = visibleLayerName(file);
    if (!layer) continue;
    const records = readDbf(file);
    visible[layer].groups += 1;
    visible[layer].records.push(...records.map(({ properties }) => properties));
    if (AUDITED_LAYERS.some((audited) => audited === layer)) {
      const auditedLayer = layer as IndoorMapCategoryLayer;
      const shapes = new Map(readShp(file.replace(/\.dbf$/i, '.shp')).map((shape) => [shape.recordNumber, shape.geometry]));
      const relativeFile = portablePath(path.relative(root, file));
      const directoryParts = portablePath(path.relative(root, path.dirname(file))).split('/');
      const sourceArea = directoryParts.find((part) => /^\d+\./.test(part)) ?? '(unknown)';
      const floor = [...directoryParts].reverse().find((part) => /^(?:B?\d+|\d+out)$/i.test(part)) ?? null;
      semanticRecords[auditedLayer].push(...records.map(({ recordNumber, properties }) => ({
        layer: auditedLayer,
        category: properties.category ?? null,
        name: properties.name ?? null,
        floor,
        sourceArea,
        sourceFile: relativeFile,
        sourceRecord: recordNumber,
        geometry: shapes.get(recordNumber) ?? null,
      })));
    }
  }
  const visibleLayers = Object.fromEntries(VISIBLE_LAYERS.map((layer) => {
    const entry = visible[layer];
    return [layer, {
      groupCount: entry.groups,
      featureCount: entry.records.length,
      category: profileValues(entry.records.map((record) => record.category ?? null)),
      name: profileValues(entry.records.map((record) => record.name ?? null)),
    }];
  }));
  const report: MapSemanticsReport = {
    generatedAt: new Date(0).toISOString(),
    sourceRoot: portablePath(path.relative(process.cwd(), root)),
    officialNetwork: {
      nodeCount: nodeRecords.length,
      linkCount: linkRecords.length,
      nodeFields: profileRecords(nodeRecords),
      linkFields: profileRecords(linkRecords),
    },
    visibleLayers,
    categoryAudit: {
      Facility: auditSemanticRecords('Facility', semanticRecords.Facility),
      Space: auditSemanticRecords('Space', semanticRecords.Space),
      Fixture: auditSemanticRecords('Fixture', semanticRecords.Fixture),
    },
    interpretationStatus: {
      node_id: { status: 'structural', note: 'Stable source node identifier.' },
      link_id: { status: 'structural', note: 'Stable source link identifier.' },
      start_id: { status: 'structural', note: 'Source reference to the start node.' },
      end_id: { status: 'structural', note: 'Source reference to the end node.' },
      distance: { status: 'confirmed-2018-mlit-spec', note: 'Link length in metres, recorded to one decimal place; geometry agreement still requires dataset validation.' },
      ordinal: { status: 'confirmed-2018-mlit-spec', note: 'Floor/vertical order; outdoor ground is 0, indoor floors use ordered integers, and intermediate levels use decimals.' },
      in_out: { status: 'confirmed-2018-mlit-spec', note: '1 outside a facility, 2 facility boundary, 3 inside a facility.' },
      rt_struct: { status: 'confirmed-2018-mlit-spec', note: '1 separated sidewalk, 2 unseparated, 3 crossing, 4 unmarked crossing, 5 underground passage, 6 pedestrian bridge, 7 indoor passage, 8 other, 99 unknown.' },
      route_type: { status: 'confirmed-2018-mlit-spec', note: '1 none, 2 moving walkway, 3 railway crossing, 4 elevator, 5 escalator, 6 stairs, 7 ramp, 99 unknown.' },
      direction: { status: 'confirmed-2018-mlit-spec', note: '1 both, 2 start-to-end, 3 end-to-start, 99 unknown.' },
      width: { status: 'confirmed-2018-mlit-spec', note: '1 under 1m, 2 from 1m to under 2m, 3 from 2m to under 3m, 4 at least 3m, 99 unknown.' },
      vtcl_slope: { status: 'confirmed-2018-mlit-spec', note: '1 at most 5%, 2 over 5% rising start-to-end, 3 over 5% falling start-to-end, 99 unknown.' },
      lev_diff: { status: 'confirmed-2018-mlit-spec', note: '1 at most 2cm, 2 over 2cm, 99 unknown.' },
      brail_tile: { status: 'confirmed-2018-mlit-spec', note: '1 tactile guidance absent, 2 present, 99 unknown.' },
      elevator: { status: 'confirmed-2018-mlit-spec', note: '1 none, 2 not accessibility-equipped, 3 wheelchair-equipped, 4 visually-impaired-equipped, 5 both, 99 unknown.' },
      roof: { status: 'confirmed-2018-mlit-spec', note: '1 absent, 2 present, 99 unknown.' },
    },
  };
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (isMainModule(import.meta.url)) {
  const report = profileMapSemantics(process.argv[2] ?? DEFAULT_ROOT, process.argv[3] ?? DEFAULT_OUTPUT);
  console.log(`Profiled ${report.officialNetwork.nodeCount} official nodes and ${report.officialNetwork.linkCount} official links.`);
  console.log(`Audited ${Object.values(report.categoryAudit).reduce((sum, layer) => sum + layer.featureCount, 0)} Space, Fixture, and Facility records.`);
  console.log(`Wrote ${process.argv[3] ?? DEFAULT_OUTPUT}.`);
}
