import type { GraphEdge, GraphNode, RoutingGraph } from './types.js';

export function reverseEdge(edge: GraphEdge): GraphEdge {
  return { ...edge, id: `${edge.id}:reverse`, from: edge.to, to: edge.from, floorFrom: edge.floorTo, floorTo: edge.floorFrom, geometry: [...edge.geometry].reverse() };
}

export function buildAdjacency(nodes: GraphNode[], edges: GraphEdge[]): RoutingGraph['adjacency'] {
  const adjacency: RoutingGraph['adjacency'] = Object.fromEntries(nodes.map(({ id }) => [id, []]));
  for (const edge of edges) {
    if (edge.direction !== 'reverse') adjacency[edge.from]?.push(edge);
    if (edge.direction !== 'forward') adjacency[edge.to]?.push(reverseEdge(edge));
  }
  for (const list of Object.values(adjacency)) list.sort((a, b) => a.to.localeCompare(b.to) || a.id.localeCompare(b.id));
  return adjacency;
}
