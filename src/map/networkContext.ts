import type { GraphEdge, GraphNode } from '../graph/types.js';

export type NetworkContext = 'inside' | 'boundary' | 'outside';

export function classifyNetworkEdgeContext(edge: GraphEdge, nodes: ReadonlyMap<string, GraphNode>): NetworkContext {
  const contexts = [nodes.get(edge.from)?.inOut, nodes.get(edge.to)?.inOut];
  if (contexts.includes('outside')) return 'outside';
  if (contexts.includes('boundary')) return 'boundary';
  return 'inside';
}
