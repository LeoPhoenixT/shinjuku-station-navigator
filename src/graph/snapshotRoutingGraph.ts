import type { GraphEdge, RoutingGraph } from './types.js';

/**
 * Copy the declared plain-data RoutingGraph schema into an owned snapshot.
 * Keep this helper and its ownership tests in sync when graph types gain mutable
 * fields: nodes/rejections currently contain scalars, while edges contain the
 * three arrays copied below. This is not a general-purpose object clone.
 */
export function snapshotRoutingGraph(source: RoutingGraph): RoutingGraph {
  const edges = new Map<GraphEdge, GraphEdge>();
  const points = new Map<[number, number, number], [number, number, number]>();
  const copyPoint = (point: [number, number, number]): [number, number, number] => {
    const existing = points.get(point);
    if (existing) return existing;
    const copy: [number, number, number] = [...point];
    points.set(point, copy);
    return copy;
  };
  const copyEdge = (edge: GraphEdge): GraphEdge => {
    const existing = edges.get(edge);
    if (existing) return existing;
    const copy: GraphEdge = {
      ...edge,
      geometry: edge.geometry.map(copyPoint),
      ...(edge.accessibilityReasons && { accessibilityReasons: [...edge.accessibilityReasons] }),
      ...(edge.accessibilityUnknowns && { accessibilityUnknowns: [...edge.accessibilityUnknowns] }),
    };
    edges.set(edge, copy);
    return copy;
  };
  return {
    nodes: source.nodes.map((node) => ({ ...node })),
    edges: source.edges.map(copyEdge),
    // Preserve filtered, directed and ordered adjacency exactly as supplied.
    adjacency: Object.fromEntries(Object.entries(source.adjacency).map(([id, adjacent]) => [id, adjacent.map(copyEdge)])),
    rejectedEdges: source.rejectedEdges.map((edge) => ({ ...edge })),
  };
}
