import type { GraphEdge, RoutingGraph } from '../graph/types.js';
import type { RouteResult } from './pathfinding.js';

/** Resolve each permitted traversal with geometry and floors oriented along the route. */
export function resolveRouteEdges(graph: RoutingGraph, route: RouteResult): GraphEdge[] {
  return route.edgeIds.map((edgeId, index) => {
    const from = route.nodeIds[index];
    const to = route.nodeIds[index + 1];
    const edge = graph.adjacency[from]?.find((candidate) => candidate.id.replace(/:reverse$/, '') === edgeId && candidate.to === to);
    if (!edge) throw new Error(`Route edge ${edgeId} is missing from adjacency at ${from} to ${to}.`);
    return edge;
  });
}
