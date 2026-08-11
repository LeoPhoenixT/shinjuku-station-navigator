import { reviewedNodeKind, type ReviewedCustomNetworkDataset } from '../schema/reviewedCustomNetwork.js';
import type { GraphEdge, GraphNode, RoutingGraph } from './types.js';

function reverseEdge(edge: GraphEdge): GraphEdge {
  return { ...edge, id: `${edge.id}:reverse`, from: edge.to, to: edge.from, floorFrom: edge.floorTo, floorTo: edge.floorFrom, geometry: [...edge.geometry].reverse() };
}

export function mergeReviewedCustomGraph(official: RoutingGraph, reviewed: ReviewedCustomNetworkDataset): RoutingGraph {
  const facilityId = official.nodes[0]?.facilityId ?? 'Shinjuku reviewed custom network';
  const customNodes = reviewed.nodes.map<GraphNode>((node) => ({
    id: node.id,
    sourceId: `reviewed:${node.id}`,
    name: node.name,
    x: node.coordinates[0],
    y: node.coordinates[1],
    z: node.coordinates[2],
    floorId: node.floorId,
    facilityId,
    kind: reviewedNodeKind(node),
    inOut: 'inside',
  }));
  const nodeById = new Map([...official.nodes, ...customNodes].map((node) => [node.id, node]));
  const customEdges = reviewed.edges.map<GraphEdge>((edge) => ({
    id: edge.id,
    sourceId: `reviewed:${edge.id}`,
    from: edge.from,
    to: edge.to,
    distanceMeters: edge.distanceMeters,
    direction: edge.direction,
    kind: edge.kind,
    accessibility: edge.accessibility,
    accessibilityUnknowns: ['reviewed-custom-link'],
    floorFrom: nodeById.get(edge.from)!.floorId,
    floorTo: nodeById.get(edge.to)!.floorId,
    geometry: edge.geometry,
  }));
  const nodes = [...official.nodes, ...customNodes].sort((a, b) => a.id.localeCompare(b.id));
  const edges = [...official.edges, ...customEdges].sort((a, b) => a.id.localeCompare(b.id));
  const adjacency: Record<string, GraphEdge[]> = Object.fromEntries(nodes.map(({ id }) => [id, []]));
  for (const edge of edges) {
    if (edge.direction !== 'reverse') adjacency[edge.from]?.push(edge);
    if (edge.direction !== 'forward') adjacency[edge.to]?.push(reverseEdge(edge));
  }
  for (const list of Object.values(adjacency)) list.sort((a, b) => a.to.localeCompare(b.to) || a.id.localeCompare(b.id));
  return { nodes, edges, adjacency, rejectedEdges: official.rejectedEdges };
}
