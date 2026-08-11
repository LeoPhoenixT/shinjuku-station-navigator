import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { lonLatToLocalMeters, SHINJUKU_LOCAL_ORIGIN } from '../src/data/coordinates.js';
import { floorElevationMeters, normalizeFloorId } from '../src/data/floors.js';
import type { LayerName, ProcessedDataset, ProcessedFeature, ProcessedGeometry } from '../src/types/processed.js';
import { readDbf, readShp, type ShapeGeometry } from './data/shapefile.js';
import { isMainModule, portablePath } from './data/is-main-module.js';

const ROOT = 'shapefile/新宿駅周辺屋内地図オープンデータ（Shapefile）';
const OUTPUT = 'public/data/processed/shinjuku-full-map.json';
const LAYERS: LayerName[] = ['Floor', 'Space', 'Facility', 'Fixture', 'Opening', 'Drawing', 'TWSI_Line', 'TWSI_Point'];
const VISIBLE_FILE = /_(Floor|Space|Facility|Fixture|Opening|Drawing|TWSI_Line|TWSI_Point)\.shp$/;

function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

export function visualFloorId(sourceFloor: string): string {
  return normalizeFloorId(sourceFloor.replace(/out$/i, ''));
}

function localize(point: [number, number], floorId: string): [number, number, number] {
  const local = lonLatToLocalMeters({ lon: point[0], lat: point[1] }, SHINJUKU_LOCAL_ORIGIN, floorElevationMeters(floorId));
  return [local.x, local.y, local.z];
}

function convertGeometry(geometry: ShapeGeometry, floorId: string): ProcessedGeometry {
  if (geometry.type === 'Point') return { type: 'Point', coordinates: localize(geometry.coordinates, floorId) };
  return { type: geometry.type, parts: geometry.parts.map((part) => part.map((point) => localize(point, floorId))) };
}

function geometryPoints(geometry: ProcessedGeometry): Array<[number, number, number]> {
  return geometry.type === 'Point' ? [geometry.coordinates] : geometry.parts.flat();
}

export function buildFullMap(output = OUTPUT): ProcessedDataset {
  const shapefiles = walk(ROOT).filter((file) => VISIBLE_FILE.test(file)).sort((a, b) => portablePath(a).localeCompare(portablePath(b)));
  const features: ProcessedFeature[] = [];
  const featureIds = new Set<string>();
  const checksums: Record<string, string> = {};
  const bounds = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
  const facilities = new Set<string>();
  const sourceFloors = new Set<string>();
  let sourceCrs = '';
  let skippedRecords = 0;
  let malformedRecords = 0;

  for (const shp of shapefiles) {
    const relative = path.relative(ROOT, shp);
    const [sourceFacility, sourceFloor] = relative.split(path.sep);
    const layer = path.basename(shp).match(VISIBLE_FILE)?.[1] as LayerName | undefined;
    if (!sourceFacility || !sourceFloor || !layer) continue;
    const floorId = visualFloorId(sourceFloor);
    const base = shp.slice(0, -4);
    const dbf = `${base}.dbf`;
    const prj = `${base}.prj`;
    facilities.add(sourceFacility);
    sourceFloors.add(sourceFloor);
    checksums[portablePath(path.relative(process.cwd(), shp))] = sha256(shp);
    checksums[portablePath(path.relative(process.cwd(), dbf))] = sha256(dbf);
    if (!sourceCrs) sourceCrs = readFileSync(prj, 'utf8').trim();
    const records = readDbf(dbf);
    for (const shape of readShp(shp)) {
      const record = records[shape.recordNumber - 1];
      if (!record) { skippedRecords += 1; continue; }
      if (!shape.geometry) { malformedRecords += 1; continue; }
      const geometry = convertGeometry(shape.geometry, floorId);
      for (const [x, y, z] of geometryPoints(geometry)) {
        bounds.minX = Math.min(bounds.minX, x); bounds.minY = Math.min(bounds.minY, y); bounds.minZ = Math.min(bounds.minZ, z);
        bounds.maxX = Math.max(bounds.maxX, x); bounds.maxY = Math.max(bounds.maxY, y); bounds.maxZ = Math.max(bounds.maxZ, z);
      }
      const sourceId = String(record.properties.id ?? `record-${shape.recordNumber}`);
      const baseId = `phase7b:${portablePath(relative.slice(0, -4))}:${sourceId}`;
      const id = featureIds.has(baseId) ? `${baseId}:record-${shape.recordNumber}` : baseId;
      if (featureIds.has(id)) throw new Error(`Visual feature ID collision remains after record qualification: ${id}`);
      featureIds.add(id);
      features.push({
        id,
        sourceId,
        sourceRecord: shape.recordNumber,
        layer,
        floorId,
        geometry,
        properties: { ...record.properties, sourceFacility, sourceFloor },
      });
    }
  }

  features.sort((a, b) => a.id.localeCompare(b.id));
  const floorIds = [...new Set(features.map(({ floorId }) => floorId!))].sort((a, b) => floorElevationMeters(a) - floorElevationMeters(b));
  const dataset: ProcessedDataset = {
    schemaVersion: 1,
    importerVersion: 'semantic-map-facility-import-2026-07-17',
    generatedAt: new Date(0).toISOString(),
    source: { facilityId: 'shinjuku-station-area', facilityName: [...facilities].sort().join(' + '), floorId: floorIds.join(','), sourceDirectory: ROOT, checksums },
    coordinateSystem: { sourceCrs, origin: SHINJUKU_LOCAL_ORIGIN, units: 'meters', axes: { x: 'east', y: 'vertical', z: 'south' } },
    layers: Object.fromEntries(LAYERS.map((layer) => [layer, { featureCount: features.filter((feature) => feature.layer === layer).length, fields: [] }])),
    features,
    statistics: { importedFeatures: features.length, skippedRecords, malformedRecords, bounds },
  };
  mkdirSync(path.dirname(output), { recursive: true });
  // This is the largest browser artifact; compact deterministic JSON keeps the
  // expanded visual context inside the explicit release-size budget.
  writeFileSync(output, `${JSON.stringify(dataset)}\n`);
  return dataset;
}

if (isMainModule(import.meta.url)) {
  const dataset = buildFullMap(process.argv[2] ?? OUTPUT);
  console.log(`Built Phase 7B visual map with ${dataset.features.length} features across ${dataset.source.floorId}.`);
}
