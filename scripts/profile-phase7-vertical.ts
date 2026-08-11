import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readDbf, readShp, type Point, type ShapeGeometry } from './data/shapefile.js';
import { isMainModule, portablePath } from './data/is-main-module.js';

const ROOT = 'shapefile/新宿駅周辺屋内地図オープンデータ（Shapefile）';
const NODE_BASE = path.join(ROOT, 'nw', 'Shinjuku_node');
const LINK_BASE = path.join(ROOT, 'nw', 'Shinjuku_link');
const B1_FLOOR = path.join(ROOT, '1.JR新宿駅改札', 'B1', 'JrSin_B1_Floor');
const GROUND_FLOOR = path.join(ROOT, '1.JR新宿駅改札', '0', 'JrSin_0_Floor');
const GROUND_SPACE = path.join(ROOT, '1.JR新宿駅改札', '0', 'JrSin_0_Space');
const OUTPUT = 'reports/phase7-vertical-profile.json';

function geometryBounds(geometries: Array<ShapeGeometry | null>): [number, number, number, number] {
  const result: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = ([x, y]: Point) => { result[0] = Math.min(result[0], x); result[1] = Math.min(result[1], y); result[2] = Math.max(result[2], x); result[3] = Math.max(result[3], y); };
  for (const geometry of geometries) {
    if (geometry?.type === 'Point') visit(geometry.coordinates);
    else geometry?.parts.flat().forEach(visit);
  }
  return result;
}

function inside([x, y]: Point, bounds: [number, number, number, number]): boolean {
  return x >= bounds[0] && x <= bounds[2] && y >= bounds[1] && y <= bounds[3];
}

export interface Phase7VerticalProfile {
  generatedAt: string;
  selection: { ordinals: [-1, 0]; floorMapping: { '-1': 'B1'; '0': '0' }; boundsSource: string; bounds: [number, number, number, number]; groundFloorNames: string[]; groundSpaceNames: string[] };
  statistics: { nodeCountByOrdinal: Record<string, number>; selectedLinkCount: number; crossFloorLinkCount: number; crossFloorMovementTypeCounts: Record<string, number> };
  crossFloorLinks: Array<{ id: string; from: string; to: string; fromOrdinal: number; toOrdinal: number; routeType: string; direction: string; distanceMeters: number; geometryRecord: number }>;
}

export function profilePhase7Vertical(output = OUTPUT): Phase7VerticalProfile {
  const bounds = geometryBounds(readShp(`${B1_FLOOR}.shp`).map(({ geometry }) => geometry));
  const nodeRecords = readDbf(`${NODE_BASE}.dbf`);
  const nodeShapes = readShp(`${NODE_BASE}.shp`);
  const selectedNodes = new Map<string, { ordinal: number }>();
  for (const shape of nodeShapes) {
    const properties = nodeRecords[shape.recordNumber - 1]?.properties;
    if (shape.geometry?.type !== 'Point' || typeof properties?.node_id !== 'string' || (properties.ordinal !== -1 && properties.ordinal !== 0) || !inside(shape.geometry.coordinates, bounds)) continue;
    selectedNodes.set(properties.node_id, { ordinal: properties.ordinal });
  }

  const linkRecords = readDbf(`${LINK_BASE}.dbf`);
  const linkShapes = readShp(`${LINK_BASE}.shp`);
  const selectedLinks: Phase7VerticalProfile['crossFloorLinks'] = [];
  let allSelectedLinkCount = 0;
  for (const shape of linkShapes) {
    const properties = linkRecords[shape.recordNumber - 1]?.properties;
    if (typeof properties?.start_id !== 'string' || typeof properties.end_id !== 'string') continue;
    const from = selectedNodes.get(properties.start_id); const to = selectedNodes.get(properties.end_id);
    if (!from || !to) continue;
    allSelectedLinkCount += 1;
    if (from.ordinal === to.ordinal || typeof properties.link_id !== 'string' || typeof properties.distance !== 'number') continue;
    selectedLinks.push({ id: properties.link_id, from: properties.start_id, to: properties.end_id, fromOrdinal: from.ordinal, toOrdinal: to.ordinal, routeType: String(properties.route_type), direction: String(properties.direction), distanceMeters: properties.distance, geometryRecord: shape.recordNumber });
  }
  selectedLinks.sort((a, b) => a.id.localeCompare(b.id));
  const groundFloorNames = [...new Set(readDbf(`${GROUND_FLOOR}.dbf`).map(({ properties }) => String(properties.name)).filter((name) => name && name !== 'undefined'))].sort();
  const groundSpaceNames = [...new Set(readDbf(`${GROUND_SPACE}.dbf`).map(({ properties }) => String(properties.name)).filter((name) => name && name !== 'undefined' && name !== '不明'))].sort();
  const movementCounts: Record<string, number> = {};
  for (const link of selectedLinks) movementCounts[link.routeType] = (movementCounts[link.routeType] ?? 0) + 1;
  const profile: Phase7VerticalProfile = {
    generatedAt: new Date(0).toISOString(),
    selection: { ordinals: [-1, 0], floorMapping: { '-1': 'B1', '0': '0' }, boundsSource: portablePath(`${B1_FLOOR}.shp`), bounds, groundFloorNames, groundSpaceNames },
    statistics: { nodeCountByOrdinal: { '-1': [...selectedNodes.values()].filter(({ ordinal }) => ordinal === -1).length, '0': [...selectedNodes.values()].filter(({ ordinal }) => ordinal === 0).length }, selectedLinkCount: allSelectedLinkCount, crossFloorLinkCount: selectedLinks.length, crossFloorMovementTypeCounts: movementCounts },
    crossFloorLinks: selectedLinks,
  };
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(profile, null, 2)}\n`);
  return profile;
}

if (isMainModule(import.meta.url)) {
  const profile = profilePhase7Vertical(process.argv[2] ?? OUTPUT);
  console.log(`Profiled ${profile.statistics.crossFloorLinkCount} B1-to-ground links.`);
}
