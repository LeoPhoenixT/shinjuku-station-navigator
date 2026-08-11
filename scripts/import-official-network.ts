import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { floorElevationMeters } from '../src/data/floors.js';
import { lonLatToLocalMeters, SHINJUKU_LOCAL_ORIGIN } from '../src/data/coordinates.js';
import type { LocalPoint, OfficialNetworkDataset, OfficialNetworkEdge, OfficialNetworkNode, Scalar } from '../src/schema/processed.js';
import { readDbf, readShp, type Point, type ShapeGeometry } from './data/shapefile.js';
import { isMainModule, portablePath } from './data/is-main-module.js';

export type OfficialNetworkSlice = OfficialNetworkDataset;

const ROOT = 'shapefile/新宿駅周辺屋内地図オープンデータ（Shapefile）';
const NODE_BASE = path.join(ROOT, 'nw', 'Shinjuku_node');
const LINK_BASE = path.join(ROOT, 'nw', 'Shinjuku_link');
const OUTPUT = 'public/data/processed/jr-shinjuku-ticket-gates-b1-official-network.json';

function sha256(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function geometryBounds(geometries: Array<ShapeGeometry | null>): [number, number, number, number] {
  const bounds: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = ([lon, lat]: Point): void => {
    bounds[0] = Math.min(bounds[0], lon); bounds[1] = Math.min(bounds[1], lat);
    bounds[2] = Math.max(bounds[2], lon); bounds[3] = Math.max(bounds[3], lat);
  };
  for (const geometry of geometries) {
    if (geometry?.type === 'Point') visit(geometry.coordinates);
    else geometry?.parts.flat().forEach(visit);
  }
  if (!bounds.every(Number.isFinite)) throw new Error('Selection geometry has invalid bounds.');
  return bounds;
}

function floorId(ordinal: number): string {
  if (ordinal < 0) return `B${Math.abs(ordinal)}`;
  if (ordinal === 0) return '0';
  return String(ordinal);
}

function localize([lon, lat]: Point, floor: string): LocalPoint {
  const point = lonLatToLocalMeters({ lon, lat }, SHINJUKU_LOCAL_ORIGIN, floorElevationMeters(floor));
  return [point.x, point.y, point.z];
}

function polylinePoints(geometry: ShapeGeometry | null): Point[] {
  if (geometry?.type !== 'PolyLine') return [];
  return geometry.parts.flat();
}

function length(points: LocalPoint[]): number {
  let result = 0;
  for (let index = 1; index < points.length; index += 1) {
    result += Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1], points[index][2] - points[index - 1][2]);
  }
  return Number(result.toFixed(3));
}

function direction(code: Scalar): OfficialNetworkEdge['direction'] {
  if (code === '1') return 'both';
  if (code === '2') return 'forward';
  if (code === '3') return 'reverse';
  throw new Error(`Unsupported direction code: ${String(code)}`);
}

function kind(code: Scalar): OfficialNetworkEdge['kind'] {
  if (code === '4') return 'elevator';
  if (code === '5') return 'escalator';
  if (code === '6') return 'stairs';
  return 'corridor';
}

function inOut(code: Scalar): OfficialNetworkNode['inOut'] {
  if (code === '1') return 'outside';
  if (code === '2') return 'boundary';
  if (code === '3') return 'inside';
  throw new Error(`Unsupported in_out code: ${String(code)}`);
}

function components(nodes: OfficialNetworkNode[], edges: OfficialNetworkEdge[]): { count: number; isolated: number } {
  const adjacency = new Map(nodes.map((node) => [node.id, new Set<string>()]));
  for (const edge of edges) { adjacency.get(edge.from)?.add(edge.to); adjacency.get(edge.to)?.add(edge.from); }
  const seen = new Set<string>();
  let count = 0;
  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    count += 1;
    const pending = [node.id];
    while (pending.length) {
      const id = pending.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const neighbor of adjacency.get(id) ?? []) pending.push(neighbor);
    }
  }
  return { count, isolated: nodes.filter((node) => adjacency.get(node.id)?.size === 0).length };
}

export function importOfficialNetwork(output = OUTPUT): OfficialNetworkDataset {
  const nodeShapes = readShp(`${NODE_BASE}.shp`);
  const nodeRecords = readDbf(`${NODE_BASE}.dbf`);
  const linkShapes = readShp(`${LINK_BASE}.shp`);
  const linkRecords = readDbf(`${LINK_BASE}.dbf`);
  const bounds = geometryBounds(nodeShapes.map(({ geometry }) => geometry));
  const nodes = nodeShapes.flatMap<OfficialNetworkNode>((shape) => {
    const record = nodeRecords[shape.recordNumber - 1];
    const props = record?.properties;
    if (!props || shape.geometry?.type !== 'Point' || typeof props.ordinal !== 'number') return [];
    if (typeof props.node_id !== 'string') throw new Error(`Node record ${shape.recordNumber} has no node_id.`);
    const selectedFloor = floorId(props.ordinal);
    return [{ id: props.node_id, sourceRecord: shape.recordNumber, floorId: selectedFloor, ordinal: props.ordinal, inOut: inOut(props.in_out), coordinates: localize(shape.geometry.coordinates, selectedFloor), sourceProperties: props }];
  }).sort((a, b) => a.id.localeCompare(b.id));
  const nodeIds = new Set(nodes.map(({ id }) => id));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  let boundaryLinkCount = 0;
  const edges = linkShapes.flatMap<OfficialNetworkEdge>((shape) => {
    const record = linkRecords[shape.recordNumber - 1];
    const props = record?.properties;
    if (!props || typeof props.start_id !== 'string' || typeof props.end_id !== 'string') return [];
    const hasStart = nodeIds.has(props.start_id); const hasEnd = nodeIds.has(props.end_id);
    if (hasStart !== hasEnd) boundaryLinkCount += 1;
    if (!hasStart || !hasEnd) return [];
    if (typeof props.link_id !== 'string' || typeof props.distance !== 'number') throw new Error(`Link record ${shape.recordNumber} is missing required values.`);
    const fromNode = nodeById.get(props.start_id)!; const toNode = nodeById.get(props.end_id)!;
    let sourceGeometry = polylinePoints(shape.geometry);
    const flatLocal = (point: Point): LocalPoint => localize(point, fromNode.floorId);
    if (sourceGeometry.length >= 2) {
      const direct = Math.hypot(flatLocal(sourceGeometry[0])[0] - fromNode.coordinates[0], flatLocal(sourceGeometry[0])[2] - fromNode.coordinates[2]);
      const reverse = Math.hypot(flatLocal(sourceGeometry.at(-1)!)[0] - fromNode.coordinates[0], flatLocal(sourceGeometry.at(-1)!)[2] - fromNode.coordinates[2]);
      if (reverse < direct) sourceGeometry = [...sourceGeometry].reverse();
    }
    const geometry = sourceGeometry.map((point, index, all) => {
      const localized = localize(point, fromNode.floorId);
      const ratio = all.length === 1 ? 0 : index / (all.length - 1);
      localized[1] = fromNode.coordinates[1] + (toNode.coordinates[1] - fromNode.coordinates[1]) * ratio;
      return localized;
    });
    if (geometry.length < 2) throw new Error(`Selected link ${props.link_id} has malformed geometry.`);
    const geometryDistanceMeters = length(geometry);
    return [{
      id: props.link_id,
      sourceRecord: shape.recordNumber,
      from: props.start_id,
      to: props.end_id,
      distanceMeters: props.distance,
      geometryDistanceMeters,
      distanceDifferenceMeters: Number(Math.abs(props.distance - geometryDistanceMeters).toFixed(3)),
      direction: direction(props.direction),
      kind: kind(props.route_type),
      floorFrom: fromNode.floorId,
      floorTo: toNode.floorId,
      // Project review approved every source link with valid endpoints for routing,
      // including cross-floor links whose source route_type is the generic corridor
      // value. Preserve that source classification; do not infer another connector kind.
      validatedForRouting: true,
      geometry,
      sourceProperties: props,
    }];
  }).sort((a, b) => a.id.localeCompare(b.id));
  const topology = components(nodes, edges);
  const movementTypeCounts = { corridor: 0, elevator: 0, escalator: 0, stairs: 0 };
  const directionCounts = { both: 0, forward: 0, reverse: 0 };
  for (const edge of edges) { movementTypeCounts[edge.kind] += 1; directionCounts[edge.direction] += 1; }
  const ordinals = [...new Set(nodes.map((node) => node.ordinal))].sort((a, b) => a - b);
  const floorIds = ordinals.map(floorId);
  const nodeCountByFloor = Object.fromEntries(floorIds.map((floor) => [floor, nodes.filter((node) => node.floorId === floor).length]));
  const crossFloorEdges = edges.filter((edge) => edge.floorFrom !== edge.floorTo);
  const verticalConnectorCounts = { elevator: 0, escalator: 0, stairs: 0 };
  for (const edge of crossFloorEdges) if (edge.kind !== 'corridor') verticalConnectorCounts[edge.kind] += 1;
  const checksums = Object.fromEntries([`${NODE_BASE}.shp`, `${NODE_BASE}.dbf`, `${LINK_BASE}.shp`, `${LINK_BASE}.dbf`].map((file) => [portablePath(file), sha256(file)]));
  const dataset: OfficialNetworkDataset = {
    schemaVersion: 1,
    importerVersion: 'phase7a-full-official-network-2026-07-16',
    generatedAt: new Date(0).toISOString(),
    source: { nodeBase: portablePath(NODE_BASE), linkBase: portablePath(LINK_BASE), geometryBase: portablePath(NODE_BASE), checksums },
    selection: { facilityId: 'shinjuku-station-area', floorId: 'multi-floor', ordinal: 0, floorIds, ordinals, sourceBounds: bounds, rule: 'All valid records from the committed official Shinjuku_node and Shinjuku_link sources; every link requires both referenced endpoints.', coverage: 'full-source' },
    coordinateSystem: { units: 'meters', origin: SHINJUKU_LOCAL_ORIGIN, axes: { x: 'east', y: 'vertical', z: 'south' } },
    nodes,
    edges,
    statistics: {
      sourceNodeCount: nodeRecords.length,
      sourceLinkCount: linkRecords.length,
      selectedNodeCount: nodes.length,
      selectedLinkCount: edges.length,
      boundaryLinkCount,
      connectedComponentCount: topology.count,
      isolatedNodeCount: topology.isolated,
      movementTypeCounts,
      nodeCountByFloor,
      crossFloorLinkCount: crossFloorEdges.length,
      unvalidatedCrossFloorLinkCount: crossFloorEdges.filter((edge) => !edge.validatedForRouting).length,
      verticalConnectorCounts,
      directionCounts,
      maxDistanceDifferenceMeters: Math.max(...edges.map(({ distanceDifferenceMeters }) => distanceDifferenceMeters)),
    },
  };
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(dataset, null, 2)}\n`);
  return dataset;
}

if (isMainModule(import.meta.url)) {
  const output = process.argv[2] ?? OUTPUT;
  const dataset = importOfficialNetwork(output);
  console.log(`Imported ${dataset.nodes.length} official nodes and ${dataset.edges.length} official links to ${output}.`);
  console.log(`Components: ${dataset.statistics.connectedComponentCount}; boundary links excluded: ${dataset.statistics.boundaryLinkCount}.`);
}
