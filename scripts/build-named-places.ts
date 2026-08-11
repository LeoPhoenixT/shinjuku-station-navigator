import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readDbf, readShp, type Point, type ShapeGeometry } from './data/shapefile.js';
import { floorElevationMeters, normalizeFloorId } from '../src/data/floors.js';
import { lonLatToLocalMeters, SHINJUKU_LOCAL_ORIGIN } from '../src/data/coordinates.js';
import { parseOfficialNetwork, type NamedPlaceRecord, type NamedPlacesDataset, type OfficialNetworkDataset } from '../src/schema/processed.js';
import { parseFloorDataset } from '../src/schema/processed.js';
import { parseReviewedCustomNetwork, type ReviewedCustomNetworkDataset } from '../src/schema/reviewedCustomNetwork.js';
import { resolveIndoorMapCategory } from '../src/data/indoorMapCategories.js';
import { buildFacilityMarkerCandidates } from '../src/map/facilityMarkers.js';
import { isMainModule, portablePath } from './data/is-main-module.js';

export type { NamedPlaceRecord as NamedPlace, NamedPlacesDataset } from '../src/schema/processed.js';

const ROOT = 'shapefile/新宿駅周辺屋内地図オープンデータ（Shapefile）';
const NETWORK = 'public/data/processed/jr-shinjuku-ticket-gates-b1-official-network.json';
const OUTPUT = 'public/data/processed/shinjuku-b1-named-places.json';
const FULL_MAP = 'public/data/processed/shinjuku-full-map.json';
const REVIEWED_NETWORK = 'public/data/processed/shinjuku-reviewed-custom-network.json';

const FACILITY_PLACE_CATEGORIES: Readonly<Record<string, NamedPlaceRecord['category']>> = {
  F001: 'toilet', F002: 'toilet', F005: 'toilet', F011: 'stairs', F012: 'elevator',
  F013: 'escalator', F014: 'slope', F017: 'entrance', F018: 'information', F020: 'waiting-room',
  F021: 'nursing-room', F030: 'atm', F031: 'locker', F101: 'ticket-office', F108: 'exit',
};

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function midpoint(points: Point[]): Point {
  if (points.length === 1) return points[0];
  const lengths = points.slice(1).map((point, index) => Math.hypot(point[0] - points[index][0], point[1] - points[index][1]));
  const target = lengths.reduce((sum, value) => sum + value, 0) / 2;
  let traversed = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    if (traversed + lengths[index] >= target) {
      const ratio = lengths[index] === 0 ? 0 : (target - traversed) / lengths[index];
      return [points[index][0] + (points[index + 1][0] - points[index][0]) * ratio, points[index][1] + (points[index + 1][1] - points[index][1]) * ratio];
    }
    traversed += lengths[index];
  }
  return points.at(-1)!;
}

function localize(point: Point, floorId: string): [number, number, number] {
  const local = lonLatToLocalMeters({ lon: point[0], lat: point[1] }, SHINJUKU_LOCAL_ORIGIN, floorElevationMeters(floorId));
  return [local.x, local.y, local.z];
}

function sourceFloor(file: string): string {
  return normalizeFloorId(path.basename(path.dirname(file)).replace(/out$/i, ''));
}

function polygonCentroid(points: Point[]): Point {
  let area = 0; let x = 0; let y = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const cross = points[index][0] * points[index + 1][1] - points[index + 1][0] * points[index][1];
    area += cross; x += (points[index][0] + points[index + 1][0]) * cross; y += (points[index][1] + points[index + 1][1]) * cross;
  }
  return Math.abs(area) < Number.EPSILON ? midpoint(points) : [x / (3 * area), y / (3 * area)];
}

function pointInPolygon(point: Point, rings: Point[][]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
      const [x, y] = ring[index];
      const [previousX, previousY] = ring[previous];
      if ((y > point[1]) !== (previousY > point[1]) && point[0] < ((previousX - x) * (point[1] - y)) / (previousY - y) + x) inside = !inside;
    }
  }
  return inside;
}

function squaredDistanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) return (point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2;
  const ratio = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)));
  const x = start[0] + ratio * dx;
  const y = start[1] + ratio * dy;
  return (point[0] - x) ** 2 + (point[1] - y) ** 2;
}

function distanceToBoundary(point: Point, rings: Point[][]): number {
  return Math.sqrt(Math.min(...rings.flatMap((ring) => ring.slice(1).map((end, index) => squaredDistanceToSegment(point, ring[index], end)))));
}

/** Deterministic point-on-surface approximation that stays inside concave and holed polygons. */
export function polygonInteriorPoint(rings: Point[][]): Point {
  const points = rings.flat();
  if (points.length === 0) throw new Error('Polygon contains no points.');
  const largestRing = [...rings].sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)))[0] ?? points;
  const centroid = polygonCentroid(largestRing);
  if (pointInPolygon(centroid, rings)) return centroid;
  const minX = Math.min(...points.map(([x]) => x));
  const maxX = Math.max(...points.map(([x]) => x));
  const minY = Math.min(...points.map(([, y]) => y));
  const maxY = Math.max(...points.map(([, y]) => y));
  let best: { point: Point; distance: number } | undefined;
  const consider = (candidate: Point) => {
    if (!pointInPolygon(candidate, rings)) return;
    const distance = distanceToBoundary(candidate, rings);
    if (!best || distance > best.distance || (distance === best.distance && (candidate[0] < best.point[0] || (candidate[0] === best.point[0] && candidate[1] < best.point[1])))) best = { point: candidate, distance };
  };
  const steps = 32;
  for (let row = 0; row < steps; row += 1) {
    for (let column = 0; column < steps; column += 1) consider([minX + (column + 0.5) * (maxX - minX) / steps, minY + (row + 0.5) * (maxY - minY) / steps]);
  }
  if (best) return best.point;
  return midpoint(largestRing);
}

function polygonArea(points: Point[]): number {
  let area = 0;
  for (let index = 0; index < points.length - 1; index += 1) area += points[index][0] * points[index + 1][1] - points[index + 1][0] * points[index][1];
  return area / 2;
}

export function representativePoint(geometry: ShapeGeometry): Point {
  if (geometry.type === 'Point') return geometry.coordinates;
  return geometry.type === 'Polygon' ? polygonInteriorPoint(geometry.parts) : midpoint(geometry.parts.flat());
}

function spaceCategory(name: string): NamedPlaceRecord['category'] | undefined {
  if (name.includes('トイレ')) return 'toilet';
  if (/^(EV[_-]|エレベーター)/i.test(name)) return 'elevator';
  if (/^(ESC[_-]|エスカレーター)/i.test(name)) return 'escalator';
  return undefined;
}

function components(network: OfficialNetworkDataset, reviewedNetwork: ReviewedCustomNetworkDataset): Map<string, number> {
  const adjacency = new Map([...network.nodes, ...reviewedNetwork.nodes].map(({ id }) => [id, new Set<string>()]));
  for (const edge of network.edges) { adjacency.get(edge.from)?.add(edge.to); adjacency.get(edge.to)?.add(edge.from); }
  for (const edge of reviewedNetwork.edges) { adjacency.get(edge.from)?.add(edge.to); adjacency.get(edge.to)?.add(edge.from); }
  const result = new Map<string, number>();
  let componentId = 0;
  for (const node of network.nodes) {
    if (result.has(node.id)) continue;
    const pending = [node.id];
    while (pending.length) {
      const id = pending.pop()!;
      if (result.has(id)) continue;
      result.set(id, componentId);
      for (const neighbor of adjacency.get(id) ?? []) pending.push(neighbor);
    }
    componentId += 1;
  }
  for (const node of reviewedNetwork.nodes) {
    if (result.has(node.id)) continue;
    const pending = [node.id];
    while (pending.length) {
      const id = pending.pop()!;
      if (result.has(id)) continue;
      result.set(id, componentId);
      for (const neighbor of adjacency.get(id) ?? []) pending.push(neighbor);
    }
    componentId += 1;
  }
  return result;
}

function confidence(distanceMeters: number): NamedPlaceRecord['access']['confidence'] {
  if (distanceMeters <= 5) return 'high';
  if (distanceMeters <= 15) return 'medium';
  return 'low';
}

export function buildNamedPlaces(networkInput = NETWORK, output = OUTPUT, mapInput = FULL_MAP, reviewedNetworkInput = REVIEWED_NETWORK): NamedPlacesDataset {
  const network = parseOfficialNetwork(JSON.parse(readFileSync(networkInput, 'utf8')));
  const reviewedNetwork = parseReviewedCustomNetwork(JSON.parse(readFileSync(reviewedNetworkInput, 'utf8')), network);
  const componentByNode = components(network, reviewedNetwork);
  const reviewedAttachmentByPlace = new Map(reviewedNetwork.placeAttachments.map((attachment) => [attachment.placeId, attachment.nodeId]));
  const reviewedNodeById = new Map(reviewedNetwork.nodes.map((node) => [node.id, node]));
  const [minLon, minLat, maxLon, maxLat] = network.selection.sourceBounds;
  const placeFiles = walk(ROOT).filter((file) => file.endsWith('_Opening.dbf') || file.endsWith('_Space.dbf')).sort();
  const places: NamedPlaceRecord[] = [];
  for (const dbfFile of placeFiles) {
    const shpFile = `${dbfFile.slice(0, -4)}.shp`;
    const floorId = sourceFloor(dbfFile);
    const isOpening = dbfFile.endsWith('_Opening.dbf');
    const records = readDbf(dbfFile);
    const shapes = readShp(shpFile);
    for (const shape of shapes) {
      const properties = records[shape.recordNumber - 1]?.properties;
      const name = properties?.name;
      if (typeof name !== 'string' || name.trim() === '' || name === '不明' || !shape.geometry) continue;
      const category = isOpening ? 'gate' : spaceCategory(name.trim());
      if (!category) continue;
      const sourceId = properties.id;
      if (typeof sourceId !== 'string') continue;
      const sourcePoint = representativePoint(shape.geometry);
      if (sourcePoint[0] < minLon || sourcePoint[0] > maxLon || sourcePoint[1] < minLat || sourcePoint[1] > maxLat) continue;
      const coordinates = localize(sourcePoint, floorId);
      const placeId = `${category}:${sourceId}`;
      const reviewedNodeId = reviewedAttachmentByPlace.get(placeId);
      const reviewedNode = reviewedNodeId ? reviewedNodeById.get(reviewedNodeId) : undefined;
      if (reviewedNode && reviewedNode.floorId !== floorId) throw new Error(`Reviewed attachment for ${placeId} is on a different floor.`);
      const nearest = reviewedNode
        ? { node: reviewedNode, distanceMeters: Math.hypot(coordinates[0] - reviewedNode.coordinates[0], coordinates[1] - reviewedNode.coordinates[1], coordinates[2] - reviewedNode.coordinates[2]) }
        : network.nodes.filter((node) => node.floorId === floorId).map((node) => ({ node, distanceMeters: Math.hypot(coordinates[0] - node.coordinates[0], coordinates[2] - node.coordinates[2]) })).sort((a, b) => a.distanceMeters - b.distanceMeters || a.node.id.localeCompare(b.node.id))[0];
      if (!nearest) throw new Error('Official network slice contains no nodes.');
      const relative = portablePath(path.relative(ROOT, dbfFile));
      const sourceFacility = relative.split('/')[0];
      places.push({
        id: placeId,
        sourceId,
        sourceFacility,
        sourceFile: relative,
        sourceRecord: shape.recordNumber,
        sourceLayer: isOpening ? 'Opening' : 'Space',
        sourceCategoryCode: isOpening ? 'Opening' : (typeof properties.category === 'string' ? properties.category : 'Space'),
        name: name.trim(),
        category,
        floorId,
        coordinates,
        routable: Boolean(reviewedNode) || confidence(nearest.distanceMeters) !== 'low',
        access: {
          nodeId: nearest.node.id,
          distanceMeters: Number(nearest.distanceMeters.toFixed(3)),
          confidence: reviewedNode ? 'high' : confidence(nearest.distanceMeters),
          reviewStatus: reviewedNode ? 'reviewed' : 'automatic',
          accessibility: 'unknown',
          componentId: componentByNode.get(nearest.node.id)!,
          geometry: [coordinates, nearest.node.coordinates],
        },
      });
    }
  }
  const elevator = network.edges.find((edge) => edge.id === '6e09f033cda0472cb754fef74c313d83') ?? network.edges.find((edge) => edge.kind === 'elevator' && edge.floorFrom !== edge.floorTo && edge.validatedForRouting);
  if (!elevator) throw new Error('Phase 7 requires one validated cross-floor elevator in the bounded slice.');
  const groundNode = network.nodes.find((node) => (node.id === elevator.from || node.id === elevator.to) && node.floorId === '0');
  if (!groundNode) throw new Error(`Elevator ${elevator.id} has no ground-floor endpoint.`);
  places.push({
    id: `connector:${elevator.id}:0`,
    sourceId: elevator.id,
    sourceFacility: '1.JR新宿駅改札',
    sourceFile: portablePath(network.source.linkBase),
    sourceRecord: elevator.sourceRecord,
    sourceLayer: 'Network',
    sourceCategoryCode: String(elevator.sourceProperties.route_type ?? '4'),
    name: '地上階エレベーター接続点',
    aliases: ['Ground-level elevator landing'],
    category: 'connector',
    nameKind: 'generated-descriptive',
    floorId: '0',
    coordinates: groundNode.coordinates,
    routable: true,
    access: { nodeId: groundNode.id, distanceMeters: 0, confidence: 'high', reviewStatus: 'reviewed', accessibility: 'yes', componentId: componentByNode.get(groundNode.id)!, geometry: [groundNode.coordinates, groundNode.coordinates] },
  });

  const fullMap = parseFloorDataset(JSON.parse(readFileSync(mapInput, 'utf8')));
  const facilityCandidates = buildFacilityMarkerCandidates(fullMap.features, network.nodes.map((node) => ({ id: node.id, floorId: node.floorId, x: node.coordinates[0], z: node.coordinates[2] })))
    .filter((candidate) => candidate.status === 'public' && FACILITY_PLACE_CATEGORIES[candidate.categoryCode])
    .sort((a, b) => a.sourceFacility.localeCompare(b.sourceFacility, 'ja') || a.floorId.localeCompare(b.floorId) || a.categoryCode.localeCompare(b.categoryCode) || a.id.localeCompare(b.id));
  const groupTotals = new Map<string, number>();
  for (const candidate of facilityCandidates) {
    const key = `${candidate.sourceFacility}\u0000${candidate.floorId}\u0000${candidate.categoryCode}`;
    groupTotals.set(key, (groupTotals.get(key) ?? 0) + 1);
  }
  const groupIndexes = new Map<string, number>();
  for (const candidate of facilityCandidates) {
    const node = network.nodes.find(({ id }) => id === candidate.alignmentNodeId);
    if (!node || candidate.alignmentDistanceMeters === undefined) continue;
    const definition = resolveIndoorMapCategory('Facility', candidate.categoryCode);
    if (!definition.known || !definition.destinationEligible) continue;
    const key = `${candidate.sourceFacility}\u0000${candidate.floorId}\u0000${candidate.categoryCode}`;
    const index = (groupIndexes.get(key) ?? 0) + 1;
    groupIndexes.set(key, index);
    const generatedName = groupTotals.get(key)! > 1 ? `${definition.nameJa} ${index}` : definition.nameJa;
    const name = candidate.sourceName ?? generatedName;
    places.push({
      id: `facility:${candidate.id.slice('facility-marker:'.length)}`,
      sourceId: candidate.sourceId,
      sourceFacility: candidate.sourceFacility,
      sourceFile: `public/data/processed/shinjuku-full-map.json#${candidate.id.slice('facility-marker:'.length)}`,
      sourceRecord: candidate.sourceRecord,
      sourceLayer: 'Facility',
      sourceCategoryCode: candidate.categoryCode,
      name,
      aliases: candidate.sourceName ? [definition.nameJa, definition.nameEn] : [definition.nameEn],
      category: FACILITY_PLACE_CATEGORIES[candidate.categoryCode],
      nameKind: candidate.sourceName ? 'source' : 'generated-category',
      floorId: candidate.floorId,
      coordinates: candidate.coordinates,
      routable: true,
      access: {
        nodeId: node.id,
        distanceMeters: candidate.alignmentDistanceMeters,
        confidence: confidence(candidate.alignmentDistanceMeters),
        reviewStatus: 'automatic',
        accessibility: 'unknown',
        componentId: componentByNode.get(node.id)!,
        geometry: [candidate.coordinates, node.coordinates],
      },
    });
  }
  places.sort((a, b) => a.name.localeCompare(b.name, 'ja') || a.id.localeCompare(b.id));
  const attachmentConfidenceCounts = { high: 0, medium: 0, low: 0 };
  const componentCounts: Record<string, number> = {};
  for (const place of places) {
    attachmentConfidenceCounts[place.access.confidence] += 1;
    const key = String(place.access.componentId);
    componentCounts[key] = (componentCounts[key] ?? 0) + 1;
  }
  const dataset: NamedPlacesDataset = {
    schemaVersion: 1,
    generatedAt: new Date(0).toISOString(),
    selectionRule: 'Existing named Opening and Space places retain their stable IDs. User-reviewed gate attachments may connect at zero distance to explicit custom gate nodes in the separate reviewed network overlay. All remaining places use deterministic same-floor official-node attachment. Public Facility marker candidates in destination-eligible categories are promoted when that attachment is within 15 m. Authoritative Japanese category names label unnamed facilities, a stable within-area/floor/category ordinal disambiguates repeats, and authoritative English category names are search aliases. Low-confidence automatic attachments remain non-routable. Every route retains an explicit measured access leg and source provenance.',
    places,
    statistics: { placeCount: places.length, routablePlaceCount: places.filter(({ routable }) => routable).length, uniqueNameCount: new Set(places.map(({ name }) => name)).size, attachmentConfidenceCounts, componentCounts },
  };
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(dataset, null, 2)}\n`);
  return dataset;
}

if (isMainModule(import.meta.url)) {
  const dataset = buildNamedPlaces(process.argv[2] ?? NETWORK, process.argv[3] ?? OUTPUT, process.argv[4] ?? FULL_MAP, process.argv[5] ?? REVIEWED_NETWORK);
  console.log(`Built ${dataset.places.length} named multi-floor places (${dataset.statistics.attachmentConfidenceCounts.high} high-confidence attachments).`);
}
