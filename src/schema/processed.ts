import type { ProcessedDataset } from '../types/processed.js';
import type { ReviewedCustomNetworkDataset } from './reviewedCustomNetwork.js';

export type Scalar = string | number | boolean | null;
export type LocalPoint = [number, number, number];

export interface OfficialNetworkNode {
  id: string;
  sourceRecord: number;
  floorId: string;
  ordinal: number;
  inOut: 'outside' | 'boundary' | 'inside';
  coordinates: LocalPoint;
  sourceProperties: Record<string, Scalar>;
}

export interface OfficialNetworkEdge {
  id: string;
  sourceRecord: number;
  from: string;
  to: string;
  distanceMeters: number;
  geometryDistanceMeters: number;
  distanceDifferenceMeters: number;
  direction: 'both' | 'forward' | 'reverse';
  kind: 'corridor' | 'elevator' | 'escalator' | 'stairs';
  floorFrom: string;
  floorTo: string;
  validatedForRouting: boolean;
  geometry: LocalPoint[];
  sourceProperties: Record<string, Scalar>;
}

export interface OfficialNetworkDataset {
  schemaVersion: 1;
  importerVersion: string;
  generatedAt: string;
  source: { nodeBase: string; linkBase: string; geometryBase: string; checksums: Record<string, string> };
  selection: { facilityId: string; floorId: string; ordinal: number; floorIds: string[]; ordinals: number[]; sourceBounds: [number, number, number, number]; rule: string; coverage: 'bounded-extraction' | 'full-source' };
  coordinateSystem: { units: 'meters'; origin: { lon: number; lat: number }; axes: { x: 'east'; y: 'vertical'; z: 'south' } };
  nodes: OfficialNetworkNode[];
  edges: OfficialNetworkEdge[];
  statistics: {
    sourceNodeCount: number;
    sourceLinkCount: number;
    selectedNodeCount: number;
    selectedLinkCount: number;
    boundaryLinkCount: number;
    connectedComponentCount: number;
    isolatedNodeCount: number;
    movementTypeCounts: Record<OfficialNetworkEdge['kind'], number>;
    nodeCountByFloor: Record<string, number>;
    crossFloorLinkCount: number;
    unvalidatedCrossFloorLinkCount: number;
    verticalConnectorCounts: Record<'elevator' | 'escalator' | 'stairs', number>;
    directionCounts: Record<OfficialNetworkEdge['direction'], number>;
    maxDistanceDifferenceMeters: number;
  };
}

export interface PlaceAccessConnection {
  nodeId: string;
  distanceMeters: number;
  confidence: 'high' | 'medium' | 'low';
  reviewStatus: 'automatic' | 'reviewed';
  accessibility: 'yes' | 'no' | 'unknown';
  componentId: number;
  geometry: [LocalPoint, LocalPoint];
}

export interface NamedPlaceRecord {
  id: string;
  sourceId: string;
  sourceFacility: string;
  sourceFile: string;
  sourceRecord: number;
  /** Required by the runtime dataset parser; optional only for lightweight in-memory test fixtures. */
  sourceLayer?: 'Opening' | 'Space' | 'Facility' | 'Network';
  /** Required by the runtime dataset parser; optional only for lightweight in-memory test fixtures. */
  sourceCategoryCode?: string;
  name: string;
  aliases?: string[];
  category: 'gate' | 'connector' | 'toilet' | 'elevator' | 'escalator' | 'stairs' | 'slope' | 'entrance' | 'exit' | 'information' | 'waiting-room' | 'nursing-room' | 'atm' | 'locker' | 'ticket-office';
  nameKind?: 'source' | 'generated-descriptive' | 'generated-category';
  floorId: string;
  coordinates: LocalPoint;
  routable: boolean;
  access: PlaceAccessConnection;
}

export interface NamedPlacesDataset {
  schemaVersion: 1;
  generatedAt: string;
  selectionRule: string;
  places: NamedPlaceRecord[];
  statistics: { placeCount: number; routablePlaceCount: number; uniqueNameCount: number; attachmentConfidenceCounts: Record<'high' | 'medium' | 'low', number>; componentCounts: Record<string, number> };
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must be a non-empty string.`);
  return value;
}

function number(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  return value;
}

function nonNegativeNumber(value: unknown, label: string): number {
  const result = number(value, label);
  if (result < 0) throw new Error(`${label} must be non-negative.`);
  return result;
}

function integer(value: unknown, label: string, minimum = 0): number {
  const result = number(value, label);
  if (!Number.isInteger(result) || result < minimum) throw new Error(`${label} must be an integer of at least ${minimum}.`);
  return result;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be boolean.`);
  return value;
}

function point(value: unknown, label: string): LocalPoint {
  if (!Array.isArray(value) || value.length !== 3) throw new Error(`${label} must be a three-number coordinate.`);
  return [number(value[0], `${label}[0]`), number(value[1], `${label}[1]`), number(value[2], `${label}[2]`)];
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`${label} has unsupported value ${String(value)}.`);
  return value as T;
}

function stringArray(value: unknown, label: string, allowEmpty = true): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || (!allowEmpty && entry.length === 0))) {
    throw new Error(`${label} must be a string array.`);
  }
  return value;
}

function scalarRecord(value: unknown, label: string): Record<string, Scalar> {
  const result = object(value, label);
  for (const [key, entry] of Object.entries(result)) {
    if (entry !== null && !['string', 'number', 'boolean'].includes(typeof entry)) throw new Error(`${label}.${key} must be scalar.`);
    if (typeof entry === 'number' && !Number.isFinite(entry)) throw new Error(`${label}.${key} must be finite.`);
  }
  return result as Record<string, Scalar>;
}

function pointsEqual(a: LocalPoint, b: LocalPoint, tolerance = 0.001): boolean {
  return a.every((value, index) => Math.abs(value - b[index]) <= tolerance);
}

function validateBounds(value: unknown, label: string): void {
  const bounds = object(value, label);
  const minX = number(bounds.minX, `${label}.minX`);
  const minY = number(bounds.minY, `${label}.minY`);
  const minZ = number(bounds.minZ, `${label}.minZ`);
  const maxX = number(bounds.maxX, `${label}.maxX`);
  const maxY = number(bounds.maxY, `${label}.maxY`);
  const maxZ = number(bounds.maxZ, `${label}.maxZ`);
  if (minX > maxX || minY > maxY || minZ > maxZ) throw new Error(`${label} minimums must not exceed maximums.`);
}

const FLOOR_LAYERS = ['Floor', 'Space', 'Opening', 'Facility', 'Fixture', 'Drawing', 'TWSI_Line', 'TWSI_Point'] as const;

export function parseFloorDataset(value: unknown): ProcessedDataset {
  const root = object(value, 'floor dataset');
  if (root.schemaVersion !== 1) throw new Error(`Unsupported floor schemaVersion ${String(root.schemaVersion)}.`);
  if (root.importerVersion !== undefined) string(root.importerVersion, 'floor importerVersion');
  if (root.generatedAt !== undefined) string(root.generatedAt, 'floor generatedAt');
  const source = object(root.source, 'floor source');
  string(source.facilityId, 'floor source.facilityId');
  string(source.facilityName, 'floor source.facilityName');
  string(source.floorId, 'floor source.floorId');
  string(source.sourceDirectory, 'floor source.sourceDirectory');
  if (source.checksums !== undefined) {
    const checksums = object(source.checksums, 'floor source.checksums');
    for (const [file, checksum] of Object.entries(checksums)) string(checksum, `floor source.checksums.${file}`);
  }
  const coordinateSystem = object(root.coordinateSystem, 'floor coordinateSystem');
  if (coordinateSystem.units !== 'meters') throw new Error('Floor coordinates must use metres.');
  if (coordinateSystem.sourceCrs !== undefined) string(coordinateSystem.sourceCrs, 'floor coordinateSystem.sourceCrs');
  if (coordinateSystem.origin !== undefined) {
    const origin = object(coordinateSystem.origin, 'floor coordinateSystem.origin');
    number(origin.lon, 'floor coordinateSystem.origin.lon');
    number(origin.lat, 'floor coordinateSystem.origin.lat');
  }
  const axes = object(coordinateSystem.axes, 'floor coordinateSystem.axes');
  string(axes.x, 'floor coordinateSystem.axes.x');
  string(axes.y, 'floor coordinateSystem.axes.y');
  string(axes.z, 'floor coordinateSystem.axes.z');
  const features = root.features;
  if (!Array.isArray(features) || features.length === 0) throw new Error('Floor dataset must contain features.');
  const featureIds = new Set<string>();
  for (const [index, featureValue] of features.entries()) {
    const feature = object(featureValue, `floor feature ${index}`);
    const id = string(feature.id, `floor feature ${index}.id`);
    if (featureIds.has(id)) throw new Error(`Duplicate floor feature ${id}.`);
    featureIds.add(id);
    string(feature.sourceId, `floor feature ${index}.sourceId`);
    integer(feature.sourceRecord, `floor feature ${id}.sourceRecord`, 1);
    const layer = oneOf(feature.layer, FLOOR_LAYERS, `floor feature ${id}.layer`);
    if (feature.floorId !== undefined) string(feature.floorId, `floor feature ${id}.floorId`);
    const geometry = object(feature.geometry, `floor feature ${id}.geometry`);
    const geometryType = oneOf(geometry.type, ['Point', 'Polygon', 'PolyLine'] as const, `floor feature ${id}.geometry.type`);
    if (geometryType === 'Point') {
      point(geometry.coordinates, `floor feature ${id}.geometry.coordinates`);
    } else {
      if (!Array.isArray(geometry.parts) || geometry.parts.length === 0) throw new Error(`Floor feature ${id}.geometry.parts must not be empty.`);
      for (const [partIndex, partValue] of geometry.parts.entries()) {
        if (!Array.isArray(partValue) || partValue.length < (geometryType === 'Polygon' ? 3 : 2)) throw new Error(`Floor feature ${id}.geometry.parts[${partIndex}] is too short.`);
        partValue.forEach((coordinate, coordinateIndex) => point(coordinate, `floor feature ${id}.geometry.parts[${partIndex}][${coordinateIndex}]`));
      }
    }
    const properties = object(feature.properties, `floor feature ${id}.properties`);
    if (layer === 'Facility') {
      if (geometryType !== 'Point') throw new Error(`Facility feature ${id} must use Point geometry.`);
      string(properties.category, `Facility feature ${id}.properties.category`);
      string(properties.sourceFacility, `Facility feature ${id}.properties.sourceFacility`);
      string(properties.sourceFloor, `Facility feature ${id}.properties.sourceFloor`);
    }
  }
  const statistics = object(root.statistics, 'floor statistics');
  if (statistics.importedFeatures !== undefined && integer(statistics.importedFeatures, 'floor statistics.importedFeatures') !== features.length) throw new Error('Floor importedFeatures does not match features.length.');
  if (statistics.skippedRecords !== undefined) integer(statistics.skippedRecords, 'floor statistics.skippedRecords');
  if (statistics.malformedRecords !== undefined) integer(statistics.malformedRecords, 'floor statistics.malformedRecords');
  validateBounds(statistics.bounds, 'floor statistics.bounds');
  return value as ProcessedDataset;
}

export function parseOfficialNetwork(value: unknown): OfficialNetworkDataset {
  const root = object(value, 'official network');
  if (root.schemaVersion !== 1) throw new Error(`Unsupported official-network schemaVersion ${String(root.schemaVersion)}.`);
  string(root.importerVersion, 'official network importerVersion');
  string(root.generatedAt, 'official network generatedAt');
  const source = object(root.source, 'official network source');
  string(source.nodeBase, 'official network source.nodeBase');
  string(source.linkBase, 'official network source.linkBase');
  string(source.geometryBase, 'official network source.geometryBase');
  const checksums = object(source.checksums, 'official network source.checksums');
  for (const [file, checksum] of Object.entries(checksums)) string(checksum, `official network source.checksums.${file}`);
  const selection = object(root.selection, 'official network selection');
  oneOf(selection.coverage, ['bounded-extraction', 'full-source'] as const, 'selection.coverage');
  string(selection.facilityId, 'selection.facilityId'); string(selection.floorId, 'selection.floorId'); number(selection.ordinal, 'selection.ordinal');
  const floorIds = stringArray(selection.floorIds, 'selection.floorIds', false);
  if (!Array.isArray(selection.ordinals)) throw new Error('Official network selection must list ordinals.');
  selection.ordinals.forEach((ordinal, index) => number(ordinal, `selection.ordinals[${index}]`));
  if (!Array.isArray(selection.sourceBounds) || selection.sourceBounds.length !== 4) throw new Error('selection.sourceBounds must contain four numbers.');
  selection.sourceBounds.forEach((bound, index) => number(bound, `selection.sourceBounds[${index}]`));
  string(selection.rule, 'selection.rule');
  const coordinateSystem = object(root.coordinateSystem, 'official network coordinateSystem');
  if (coordinateSystem.units !== 'meters') throw new Error('Official network coordinates must use metres.');
  const origin = object(coordinateSystem.origin, 'official network coordinateSystem.origin');
  number(origin.lon, 'official network coordinateSystem.origin.lon');
  number(origin.lat, 'official network coordinateSystem.origin.lat');
  const axes = object(coordinateSystem.axes, 'official network coordinateSystem.axes');
  oneOf(axes.x, ['east'] as const, 'official network coordinateSystem.axes.x');
  oneOf(axes.y, ['vertical'] as const, 'official network coordinateSystem.axes.y');
  oneOf(axes.z, ['south'] as const, 'official network coordinateSystem.axes.z');
  if (!Array.isArray(root.nodes) || !Array.isArray(root.edges)) throw new Error('Official network must contain node and edge arrays.');
  const nodeIds = new Set<string>();
  const nodeById = new Map<string, { floorId: string; coordinates: LocalPoint }>();
  for (const [index, nodeValue] of root.nodes.entries()) {
    const node = object(nodeValue, `official node ${index}`);
    const id = string(node.id, `official node ${index}.id`);
    if (nodeIds.has(id)) throw new Error(`Duplicate official node ${id}.`);
    nodeIds.add(id);
    integer(node.sourceRecord, `official node ${id}.sourceRecord`, 1);
    const coordinates = point(node.coordinates, `official node ${id}.coordinates`);
    const floorId = string(node.floorId, `official node ${id}.floorId`);
    if (!floorIds.includes(floorId)) throw new Error(`Official node ${id} uses floor ${floorId} outside selection.floorIds.`);
    number(node.ordinal, `official node ${id}.ordinal`);
    oneOf(node.inOut, ['outside', 'boundary', 'inside'] as const, `official node ${id}.inOut`);
    scalarRecord(node.sourceProperties, `official node ${id}.sourceProperties`);
    nodeById.set(id, { floorId, coordinates });
  }
  const edgeIds = new Set<string>();
  for (const [index, edgeValue] of root.edges.entries()) {
    const edge = object(edgeValue, `official edge ${index}`);
    const id = string(edge.id, `official edge ${index}.id`);
    if (edgeIds.has(id)) throw new Error(`Duplicate official edge ${id}.`);
    edgeIds.add(id);
    integer(edge.sourceRecord, `official edge ${id}.sourceRecord`, 1);
    const from = string(edge.from, `official edge ${id}.from`); const to = string(edge.to, `official edge ${id}.to`);
    if (!nodeIds.has(from) || !nodeIds.has(to)) throw new Error(`Official edge ${id} has an invalid node reference.`);
    nonNegativeNumber(edge.distanceMeters, `official edge ${id}.distanceMeters`);
    nonNegativeNumber(edge.geometryDistanceMeters, `official edge ${id}.geometryDistanceMeters`);
    nonNegativeNumber(edge.distanceDifferenceMeters, `official edge ${id}.distanceDifferenceMeters`);
    oneOf(edge.direction, ['both', 'forward', 'reverse'] as const, `official edge ${id}.direction`);
    oneOf(edge.kind, ['corridor', 'elevator', 'escalator', 'stairs'] as const, `official edge ${id}.kind`);
    const floorFrom = string(edge.floorFrom, `official edge ${id}.floorFrom`); const floorTo = string(edge.floorTo, `official edge ${id}.floorTo`);
    if (nodeById.get(from)?.floorId !== floorFrom || nodeById.get(to)?.floorId !== floorTo) throw new Error(`Official edge ${id} floor endpoints do not match its nodes.`);
    boolean(edge.validatedForRouting, `official edge ${id}.validatedForRouting`);
    if (!Array.isArray(edge.geometry) || edge.geometry.length < 2) throw new Error(`Official edge ${id} has malformed geometry.`);
    const geometry = edge.geometry.map((coordinate, coordinateIndex) => point(coordinate, `official edge ${id}.geometry[${coordinateIndex}]`));
    if (!pointsEqual(geometry[0], nodeById.get(from)!.coordinates) || !pointsEqual(geometry.at(-1)!, nodeById.get(to)!.coordinates)) throw new Error(`Official edge ${id} geometry endpoints do not match its nodes.`);
    scalarRecord(edge.sourceProperties, `official edge ${id}.sourceProperties`);
  }
  const statistics = object(root.statistics, 'official network statistics');
  if (integer(statistics.selectedNodeCount, 'official network statistics.selectedNodeCount') !== root.nodes.length) throw new Error('Official network selectedNodeCount does not match nodes.length.');
  if (integer(statistics.selectedLinkCount, 'official network statistics.selectedLinkCount') !== root.edges.length) throw new Error('Official network selectedLinkCount does not match edges.length.');
  return value as OfficialNetworkDataset;
}

export function parseNamedPlaces(value: unknown, network?: OfficialNetworkDataset, reviewedNetwork?: ReviewedCustomNetworkDataset): NamedPlacesDataset {
  const root = object(value, 'named places');
  if (root.schemaVersion !== 1) throw new Error(`Unsupported places schemaVersion ${String(root.schemaVersion)}.`);
  string(root.generatedAt, 'named places generatedAt');
  string(root.selectionRule, 'named places selectionRule');
  if (!Array.isArray(root.places)) throw new Error('Named places must contain a places array.');
  const nodeById = network ? new Map([
    ...network.nodes.map((node) => [node.id, { floorId: node.floorId, coordinates: node.coordinates }] as const),
    ...(reviewedNetwork?.nodes ?? []).map((node) => [node.id, { floorId: node.floorId, coordinates: node.coordinates }] as const),
  ]) : undefined;
  const ids = new Set<string>();
  for (const [index, placeValue] of root.places.entries()) {
    const place = object(placeValue, `place ${index}`);
    const id = string(place.id, `place ${index}.id`);
    if (ids.has(id)) throw new Error(`Duplicate place ${id}.`);
    ids.add(id);
    string(place.sourceId, `place ${id}.sourceId`);
    string(place.sourceFacility, `place ${id}.sourceFacility`);
    string(place.sourceFile, `place ${id}.sourceFile`);
    integer(place.sourceRecord, `place ${id}.sourceRecord`, 1);
    oneOf(place.sourceLayer, ['Opening', 'Space', 'Facility', 'Network'] as const, `place ${id}.sourceLayer`);
    string(place.sourceCategoryCode, `place ${id}.sourceCategoryCode`);
    string(place.name, `place ${id}.name`);
    const coordinates = point(place.coordinates, `place ${id}.coordinates`);
    if (place.aliases !== undefined) stringArray(place.aliases, `place ${id}.aliases`);
    oneOf(place.category, ['gate', 'connector', 'toilet', 'elevator', 'escalator', 'stairs', 'slope', 'entrance', 'exit', 'information', 'waiting-room', 'nursing-room', 'atm', 'locker', 'ticket-office'] as const, `place ${id}.category`);
    if (place.nameKind !== undefined) oneOf(place.nameKind, ['source', 'generated-descriptive', 'generated-category'] as const, `place ${id}.nameKind`);
    const floorId = string(place.floorId, `place ${id}.floorId`);
    boolean(place.routable, `place ${id}.routable`);
    const access = object(place.access, `place ${id}.access`);
    const nodeId = string(access.nodeId, `place ${id}.access.nodeId`);
    const node = nodeById?.get(nodeId);
    if (nodeById && !node) throw new Error(`Place ${id} refers to missing node ${nodeId}.`);
    if (node && node.floorId !== floorId) throw new Error(`Place ${id} and access node ${nodeId} are on different floors.`);
    const distanceMeters = nonNegativeNumber(access.distanceMeters, `place ${id}.access.distanceMeters`);
    oneOf(access.confidence, ['high', 'medium', 'low'] as const, `place ${id}.access.confidence`);
    oneOf(access.reviewStatus, ['automatic', 'reviewed'] as const, `place ${id}.access.reviewStatus`);
    oneOf(access.accessibility, ['yes', 'no', 'unknown'] as const, `place ${id}.access.accessibility`);
    integer(access.componentId, `place ${id}.access.componentId`);
    if (!Array.isArray(access.geometry) || access.geometry.length !== 2) throw new Error(`Place ${id}.access.geometry must contain two points.`);
    const accessStart = point(access.geometry[0], `place ${id}.access.geometry[0]`); const accessEnd = point(access.geometry[1], `place ${id}.access.geometry[1]`);
    if (!pointsEqual(accessStart, coordinates)) throw new Error(`Place ${id} access geometry must start at the place coordinate.`);
    if (node && !pointsEqual(accessEnd, node.coordinates)) throw new Error(`Place ${id} access geometry must end at its official node.`);
    const measuredDistance = Math.hypot(accessEnd[0] - accessStart[0], accessEnd[1] - accessStart[1], accessEnd[2] - accessStart[2]);
    if (Math.abs(measuredDistance - distanceMeters) > 0.01) throw new Error(`Place ${id} access distance does not match its geometry.`);
  }
  const statistics = object(root.statistics, 'named places statistics');
  if (integer(statistics.placeCount, 'named places statistics.placeCount') !== root.places.length) throw new Error('Named places placeCount does not match places.length.');
  integer(statistics.routablePlaceCount, 'named places statistics.routablePlaceCount');
  integer(statistics.uniqueNameCount, 'named places statistics.uniqueNameCount');
  object(statistics.attachmentConfidenceCounts, 'named places statistics.attachmentConfidenceCounts');
  object(statistics.componentCounts, 'named places statistics.componentCounts');
  return value as NamedPlacesDataset;
}
