import { buildAdjacency } from './adjacency.js';
import { reviewedNodeKind, type ReviewedCustomNetworkDataset } from '../schema/reviewedCustomNetwork.js';
import type { GraphEdge, GraphNode, RoutingGraph } from './types.js';

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
  const adjacency = buildAdjacency(nodes, edges);
  return { nodes, edges, adjacency, rejectedEdges: official.rejectedEdges };
}
