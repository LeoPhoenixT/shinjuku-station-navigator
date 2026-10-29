import { describe, expect, it } from 'vitest';
import { buildAdjacency } from '../src/graph/adjacency.js';
import type { GraphEdge, GraphNode, RoutingGraph } from '../src/graph/types.js';
import { resolveRouteEdges } from '../src/routing/routeEdges.js';

const nodes: GraphNode[] = ['a', 'b', 'c'].map((id) => ({ id, x: 0, y: 0, z: 0, floorId: 'B1', facilityId: 'fixture', kind: 'normal' }));
const edge: GraphEdge = { id: 'ab', from: 'a', to: 'b', distanceMeters: 4, direction: 'both', kind: 'elevator', accessibility: 'unknown', accessibilityUnknowns: ['width'], floorFrom: 'B1', floorTo: '0', geometry: [[0, -5, 0], [0, 0, 0]] };

function graph(direction: GraphEdge['direction']): RoutingGraph {
  const edges = [{ ...edge, direction }];
  return { nodes, edges, adjacency: buildAdjacency(nodes, edges), rejectedEdges: [] };
}

describe('directed adjacency and route traversal', () => {
  it.each(['both', 'forward', 'reverse'] as const)('preserves %s direction and leaves source edges intact', (direction) => {
    const network = graph(direction);
    expect(network.adjacency.a).toHaveLength(direction === 'reverse' ? 0 : 1);
    expect(network.adjacency.b).toHaveLength(direction === 'forward' ? 0 : 1);
    expect(network.adjacency.c).toEqual([]);
    if (direction !== 'forward') {
      expect(resolveRouteEdges(network, { nodeIds: ['b', 'a'], edgeIds: ['ab'], distanceMeters: 4, totalCost: 4 })).toEqual([
        expect.objectContaining({ id: 'ab:reverse', from: 'b', to: 'a', floorFrom: '0', floorTo: 'B1', geometry: [[0, 0, 0], [0, -5, 0]], accessibilityUnknowns: ['width'] }),
      ]);
    }
    expect(network.edges[0]).toEqual({ ...edge, direction });
  });

  it('rejects traversal against direction and mismatched route endpoints', () => {
    expect(() => resolveRouteEdges(graph('forward'), { nodeIds: ['b', 'a'], edgeIds: ['ab'], distanceMeters: 4, totalCost: 4 })).toThrow('missing from adjacency');
    expect(() => resolveRouteEdges(graph('both'), { nodeIds: ['a', 'c'], edgeIds: ['ab'], distanceMeters: 4, totalCost: 4 })).toThrow('missing from adjacency');
  });

  it('sorts adjacency by destination then edge ID', () => {
    const edges = [{ ...edge, id: 'z', to: 'c' }, { ...edge, id: 'b' }, { ...edge, id: 'a' }];
    expect(buildAdjacency(nodes, edges).a.map(({ id }) => id)).toEqual(['a', 'b', 'z']);
  });
});
