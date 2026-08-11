import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { floorElevationMeters, normalizeFloorId } from '../src/data/floors.js';
import { lonLatToLocalMeters, SHINJUKU_LOCAL_ORIGIN } from '../src/data/coordinates.js';
import { readDbf, readShp, type ShapeGeometry } from './data/shapefile.js';
import { isMainModule, portablePath } from './data/is-main-module.js';

type LayerName = 'Floor' | 'Space' | 'Opening' | 'Facility' | 'Fixture' | 'TWSI_Line' | 'TWSI_Point';
interface ProcessedFeature { id: string; sourceId: string; sourceRecord: number; layer: LayerName; geometry: unknown; properties: Record<string, unknown> }
interface ProcessedDataset { schemaVersion: 1; importerVersion: string; generatedAt: string; source: { facilityId: string; facilityName: string; floorId: string; sourceDirectory: string; checksums: Record<string, string> }; coordinateSystem: { sourceCrs: string; origin: typeof SHINJUKU_LOCAL_ORIGIN; units: 'meters'; axes: { x: string; y: string; z: string } }; layers: Record<string, { featureCount: number; fields: string[] }>; features: ProcessedFeature[]; statistics: { importedFeatures: number; skippedRecords: number; malformedRecords: number; bounds: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number } } }

const ROOT = 'shapefile/新宿駅周辺屋内地図オープンデータ（Shapefile）/1.JR新宿駅改札/B1';
const OUTPUT = 'public/data/processed/jr-shinjuku-ticket-gates-b1.json';
const LAYERS: LayerName[] = ['Floor', 'Space', 'Opening', 'Facility', 'Fixture', 'TWSI_Line', 'TWSI_Point'];

function sha256(filePath: string): string { return createHash('sha256').update(readFileSync(filePath)).digest('hex'); }
function stableProperties(properties: Record<string, unknown>): Record<string, unknown> { return Object.fromEntries(Object.entries(properties).sort(([a], [b]) => a.localeCompare(b))); }
function sourceId(properties: Record<string, unknown>, fallback: number): string { return String(properties.id ?? `record-${fallback}`); }
function localize(point: [number, number], floorId: string): [number, number, number] { const p = lonLatToLocalMeters({ lon: point[0], lat: point[1] }, SHINJUKU_LOCAL_ORIGIN, floorElevationMeters(floorId)); return [p.x, p.y, p.z]; }
function convertGeometry(geometry: ShapeGeometry, floorId: string): unknown {
  if (geometry.type === 'Point') return { type: 'Point', coordinates: localize(geometry.coordinates, floorId) };
  return { type: geometry.type, parts: geometry.parts.map((part) => part.map((point) => localize(point, floorId))) };
}
function updateBounds(bounds: ProcessedDataset['statistics']['bounds'], geometry: unknown): void {
  const visit = (value: unknown): void => {
    if (Array.isArray(value) && value.length === 3 && value.every((v) => typeof v === 'number')) {
      const [x, y, z] = value as [number, number, number];
      bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x);
      bounds.minY = Math.min(bounds.minY, y); bounds.maxY = Math.max(bounds.maxY, y);
      bounds.minZ = Math.min(bounds.minZ, z); bounds.maxZ = Math.max(bounds.maxZ, z);
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(geometry);
}

export function convertDataset(output = OUTPUT, sourceRoot = ROOT): ProcessedDataset {
  const floorId = normalizeFloorId('B1');
  const stats = { importedFeatures: 0, skippedRecords: 0, malformedRecords: 0, bounds: { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity } };
  const features: ProcessedFeature[] = [];
  const layers: ProcessedDataset['layers'] = {};
  const checksums: Record<string, string> = {};
  const sourceCrs = readFileSync(path.join(sourceRoot, 'JrSin_B1_Floor.prj'), 'utf8').trim();
  for (const layer of LAYERS) {
    const base = path.join(sourceRoot, `JrSin_B1_${layer}`);
    const shp = `${base}.shp`; const dbf = `${base}.dbf`;
    try { readFileSync(shp); } catch { continue; }
    checksums[portablePath(path.relative(process.cwd(), shp))] = sha256(shp);
    checksums[portablePath(path.relative(process.cwd(), dbf))] = sha256(dbf);
    const shapes = readShp(shp);
    const records = readDbf(dbf);
    layers[layer] = { featureCount: 0, fields: Object.keys(records[0]?.properties ?? {}).sort() };
    for (const shape of shapes) {
      const record = records[shape.recordNumber - 1];
      if (!record || !shape.geometry) { stats.skippedRecords++; continue; }
      const props = stableProperties(record.properties);
      const featureFloor = floorId;
      const geometry = convertGeometry(shape.geometry, featureFloor);
      const id = `jr-shinjuku-ticket-gates:${featureFloor}:${layer}:${sourceId(props, shape.recordNumber)}`;
      features.push({ id, sourceId: sourceId(props, shape.recordNumber), sourceRecord: shape.recordNumber, layer, geometry, properties: props });
      layers[layer].featureCount++; stats.importedFeatures++; updateBounds(stats.bounds, geometry);
    }
  }
  features.sort((a, b) => a.id.localeCompare(b.id));
  const dataset: ProcessedDataset = { schemaVersion: 1, importerVersion: 'phase2-2026-07-15', generatedAt: new Date(0).toISOString(), source: { facilityId: 'jr-shinjuku-ticket-gates', facilityName: '1.JR新宿駅改札', floorId, sourceDirectory: sourceRoot, checksums }, coordinateSystem: { sourceCrs, origin: SHINJUKU_LOCAL_ORIGIN, units: 'meters', axes: { x: 'east', y: 'vertical', z: 'south' } }, layers, features, statistics: stats };
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(dataset, null, 2)}\n`);
  return dataset;
}

if (isMainModule(import.meta.url)) {
  const dataset = convertDataset(process.argv[2] ?? OUTPUT);
  console.log(`Imported ${dataset.statistics.importedFeatures} features to ${process.argv[2] ?? OUTPUT}.`);
}
