import type { GraphEdgeKind, GraphNodeKind } from '../graph/types.js';
import type { LocalPoint, OfficialNetworkDataset } from './processed.js';

export interface ReviewedCustomNetworkNode {
  id: string;
  name: string;
  floorId: string;
  role: 'gate' | 'turn';
  coordinates: LocalPoint;
}

export interface ReviewedCustomNetworkEdge {
  id: string;
  from: string;
  to: string;
  distanceMeters: number;
  direction: 'both';
  kind: Extract<GraphEdgeKind, 'corridor' | 'gate'>;
  accessibility: 'unknown';
  geometry: [LocalPoint, LocalPoint];
}

export interface ReviewedPlaceAttachment {
  placeId: string;
  nodeId: string;
}

export interface ReviewedCustomNetworkDataset {
  schemaVersion: 1;
  revision: string;
  generatedAt: string;
  approval: {
    status: 'reviewed';
    basis: string;
  };
  coordinateSystem: OfficialNetworkDataset['coordinateSystem'];
  nodes: ReviewedCustomNetworkNode[];
  edges: ReviewedCustomNetworkEdge[];
  placeAttachments: ReviewedPlaceAttachment[];
  statistics: {
    nodeCount: number;
    edgeCount: number;
    attachedPlaceCount: number;
  };
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must be a non-empty string.`);
  return value;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  return value;
}

function point(value: unknown, label: string): LocalPoint {
  if (!Array.isArray(value) || value.length !== 3) throw new Error(`${label} must contain three coordinates.`);
  return [finiteNumber(value[0], `${label}[0]`), finiteNumber(value[1], `${label}[1]`), finiteNumber(value[2], `${label}[2]`)];
}

function pointsEqual(a: LocalPoint, b: LocalPoint, tolerance = 0.001): boolean {
  return a.every((coordinate, index) => Math.abs(coordinate - b[index]) <= tolerance);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`${label} has unsupported value ${String(value)}.`);
  return value as T;
}

export function reviewedNodeKind(node: ReviewedCustomNetworkNode): GraphNodeKind {
  return node.role === 'gate' ? 'gate' : 'normal';
}

export function parseReviewedCustomNetwork(value: unknown, officialNetwork: OfficialNetworkDataset): ReviewedCustomNetworkDataset {
  const root = object(value, 'reviewed custom network');
  if (root.schemaVersion !== 1) throw new Error(`Unsupported reviewed-custom-network schemaVersion ${String(root.schemaVersion)}.`);
  string(root.revision, 'reviewed custom network revision');
  string(root.generatedAt, 'reviewed custom network generatedAt');
  const approval = object(root.approval, 'reviewed custom network approval');
  if (approval.status !== 'reviewed') throw new Error('Reviewed custom network must have reviewed approval status.');
  string(approval.basis, 'reviewed custom network approval.basis');
  const coordinateSystem = object(root.coordinateSystem, 'reviewed custom network coordinateSystem');
  if (JSON.stringify(coordinateSystem) !== JSON.stringify(officialNetwork.coordinateSystem)) throw new Error('Reviewed custom network coordinate system must match the official network.');
  if (!Array.isArray(root.nodes) || !Array.isArray(root.edges) || !Array.isArray(root.placeAttachments)) {
    throw new Error('Reviewed custom network must contain node, edge, and place attachment arrays.');
  }

  const officialNodes = new Map(officialNetwork.nodes.map((node) => [node.id, node]));
  const nodes = new Map<string, { floorId: string; coordinates: LocalPoint; role: 'gate' | 'turn' }>();
  for (const [index, valueNode] of root.nodes.entries()) {
    const node = object(valueNode, `reviewed custom node ${index}`);
    const id = string(node.id, `reviewed custom node ${index}.id`);
    if (nodes.has(id) || officialNodes.has(id)) throw new Error(`Duplicate reviewed custom node ${id}.`);
    const floorId = string(node.floorId, `reviewed custom node ${id}.floorId`);
    if (!officialNetwork.selection.floorIds.includes(floorId)) throw new Error(`Reviewed custom node ${id} uses an unknown floor.`);
    nodes.set(id, {
      floorId,
      coordinates: point(node.coordinates, `reviewed custom node ${id}.coordinates`),
      role: oneOf(node.role, ['gate', 'turn'] as const, `reviewed custom node ${id}.role`),
    });
    string(node.name, `reviewed custom node ${id}.name`);
  }

  const nodeDetails = (id: string) => {
    const custom = nodes.get(id);
    if (custom) return custom;
    const official = officialNodes.get(id);
    return official ? { floorId: official.floorId, coordinates: official.coordinates, role: undefined } : undefined;
  };
  const edgeIds = new Set<string>();
  for (const [index, valueEdge] of root.edges.entries()) {
    const edge = object(valueEdge, `reviewed custom edge ${index}`);
    const id = string(edge.id, `reviewed custom edge ${index}.id`);
    if (edgeIds.has(id) || officialNetwork.edges.some((official) => official.id === id)) throw new Error(`Duplicate reviewed custom edge ${id}.`);
    edgeIds.add(id);
    const from = string(edge.from, `reviewed custom edge ${id}.from`);
    const to = string(edge.to, `reviewed custom edge ${id}.to`);
    const fromNode = nodeDetails(from);
    const toNode = nodeDetails(to);
    if (!fromNode || !toNode) throw new Error(`Reviewed custom edge ${id} has an invalid node reference.`);
    if (fromNode.floorId !== toNode.floorId) throw new Error(`Reviewed custom edge ${id} must stay on one floor.`);
    if (edge.direction !== 'both') throw new Error(`Reviewed custom edge ${id} must be bidirectional.`);
    oneOf(edge.kind, ['corridor', 'gate'] as const, `reviewed custom edge ${id}.kind`);
    if (edge.accessibility !== 'unknown') throw new Error(`Reviewed custom edge ${id} accessibility must remain unknown until surveyed.`);
    const distance = finiteNumber(edge.distanceMeters, `reviewed custom edge ${id}.distanceMeters`);
    if (distance <= 0) throw new Error(`Reviewed custom edge ${id} must have positive distance.`);
    if (!Array.isArray(edge.geometry) || edge.geometry.length !== 2) throw new Error(`Reviewed custom edge ${id} must have two-point geometry.`);
    const start = point(edge.geometry[0], `reviewed custom edge ${id}.geometry[0]`);
    const end = point(edge.geometry[1], `reviewed custom edge ${id}.geometry[1]`);
    if (!pointsEqual(start, fromNode.coordinates) || !pointsEqual(end, toNode.coordinates)) throw new Error(`Reviewed custom edge ${id} geometry must end at its nodes.`);
    const measured = Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
    if (Math.abs(measured - distance) > 0.001) throw new Error(`Reviewed custom edge ${id} distance does not match its geometry.`);
  }

  const attachmentPlaces = new Set<string>();
  const attachmentNodes = new Set<string>();
  for (const [index, valueAttachment] of root.placeAttachments.entries()) {
    const attachment = object(valueAttachment, `reviewed place attachment ${index}`);
    const placeId = string(attachment.placeId, `reviewed place attachment ${index}.placeId`);
    const nodeId = string(attachment.nodeId, `reviewed place attachment ${index}.nodeId`);
    if (attachmentPlaces.has(placeId)) throw new Error(`Duplicate reviewed place attachment ${placeId}.`);
    const node = nodes.get(nodeId);
    if (!node || node.role !== 'gate') throw new Error(`Reviewed place attachment ${placeId} must refer to a custom gate node.`);
    if (attachmentNodes.has(nodeId)) throw new Error(`Reviewed gate node ${nodeId} is attached more than once.`);
    attachmentPlaces.add(placeId);
    attachmentNodes.add(nodeId);
  }

  const statistics = object(root.statistics, 'reviewed custom network statistics');
  if (statistics.nodeCount !== root.nodes.length || statistics.edgeCount !== root.edges.length || statistics.attachedPlaceCount !== root.placeAttachments.length) {
    throw new Error('Reviewed custom network statistics do not match its arrays.');
  }
  return value as ReviewedCustomNetworkDataset;
}
