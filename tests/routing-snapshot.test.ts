import { describe, expect, it } from 'vitest';
import { snapshotRoutingGraph } from '../src/graph/snapshotRoutingGraph';
import type { GraphEdge, RoutingGraph } from '../src/graph/types';
import { admissibleHeuristicScale, astar, createRouteSearchContext, dijkstra, ROUTING_PROFILES } from '../src/routing/pathfinding';

function snapshotFixture(): RoutingGraph {
  const a: [number, number, number] = [0, 0, 0];
  const b: [number, number, number] = [1, 0, 0];
  const ab: GraphEdge = {
    id: 'ab', sourceId: 'source-ab', from: 'a', to: 'b', distanceMeters: 1,
    direction: 'both', kind: 'corridor', accessibility: 'unknown',
    accessibilityReasons: ['not-reviewed'], accessibilityUnknowns: ['width'],
    floorFrom: 'B1', floorTo: 'B1', geometry: [a, b],
  };
  const reverse: GraphEdge = { ...ab, id: 'ab:reverse', from: 'b', to: 'a', geometry: [b, a] };
  // Equal coordinates with a distinct identity must remain distinct in the copy.
  const bc: GraphEdge = { ...ab, id: 'bc', from: 'b', to: 'c', direction: 'forward', geometry: [[...b], [2, 0, 0]] };
  return {
    nodes: ['a', 'b', 'c'].map((id, index) => ({
      id, sourceId: `source-${id}`, name: id, x: index, y: 0, z: 0,
      floorId: 'B1', facilityId: 'fixture', kind: 'normal', inOut: 'inside',
    })),
    edges: [ab, bc],
    adjacency: { a: [ab], b: [bc, reverse], c: [] },
    rejectedEdges: [{ sourceId: 'rejected', reason: 'missing-both-nodes', startNode: 'missing-start', endNode: 'missing-end' }],
  };
}

describe('owned routing graph snapshot', () => {
  it('preserves copied edge and coordinate sharing without retaining mutable source fields', () => {
    const source = snapshotFixture();
    const snapshot = snapshotRoutingGraph(source);
    expect(snapshot).toEqual(source);
    expect(snapshot.edges[0]).toBe(snapshot.adjacency.a[0]);
    expect(snapshot.edges[1]).toBe(snapshot.adjacency.b[0]);
    expect(snapshot.adjacency.b[1].geometry[0]).toBe(snapshot.edges[0].geometry[1]);
    expect(snapshot.adjacency.b[1].geometry[1]).toBe(snapshot.edges[0].geometry[0]);
    expect(snapshot.edges[1].geometry[0]).not.toBe(snapshot.edges[0].geometry[1]);
    expect(snapshot.edges[1].geometry[0]).toEqual(snapshot.edges[0].geometry[1]);

    const pristine = structuredClone(snapshot);
    source.nodes[0].x = 999;
    source.nodes[0].name = 'changed';
    source.edges[0].distanceMeters = 999;
    source.edges[0].geometry[0][0] = 999;
    source.edges[0].geometry.push([999, 999, 999]);
    source.edges[0].accessibilityReasons?.push('changed');
    source.edges[0].accessibilityUnknowns?.splice(0);
    source.adjacency.b[1].geometry[0][2] = 999;
    source.rejectedEdges[0].startNode = 'changed';
    source.adjacency.a.splice(0);
    source.adjacency.extra = [];
    source.edges.pop();
    source.nodes.pop();
    source.rejectedEdges.pop();
    expect(snapshot).toEqual(pristine);
  });

  it('keeps directed, reverse-only, filtered and ordered adjacency instead of rebuilding it', () => {
    const source = snapshotFixture();
    source.adjacency.a = []; // The authoritative edge remains in edges but is filtered out here.
    const snapshot = snapshotRoutingGraph(source);
    expect(snapshot.adjacency.a).toEqual([]);
    expect(snapshot.adjacency.b.map(({ id }) => id)).toEqual(['bc', 'ab:reverse']);
    const context = createRouteSearchContext(source);
    for (const profile of ROUTING_PROFILES) {
      expect(admissibleHeuristicScale(snapshot, { profile })).toBe(admissibleHeuristicScale(source, { profile }));
      expect(context.search('a', 'c', { profile })).toBeNull();
      expect(context.search('c', 'b', { profile })).toBeNull();
      expect(context.search('b', 'a', { profile })).toEqual(astar(source, 'b', 'a', { profile }));
      expect(context.search('b', 'c', { profile })?.totalCost).toBe(dijkstra(source, 'b', 'c', { profile })?.totalCost);
    }
    const reverse = context.search('b', 'a');
    if (!reverse) throw new Error('Expected a permitted reverse traversal.');
    expect(context.resolveRouteEdges(reverse)[0].geometry).toEqual([[1, 0, 0], [0, 0, 0]]);
  });

  it('retains isolated accessibility arrays and geometry across source and result mutations', () => {
    const source = snapshotFixture();
    const context = createRouteSearchContext(source);
    source.edges[0].accessibilityUnknowns?.push('source-change');
    source.edges[0].accessibilityReasons?.push('source-change');
    source.edges[0].geometry[0][0] = 999;
    const route = context.search('b', 'a', { profile: 'accessible' });
    if (!route) throw new Error('Expected accessible fixture traversal.');
    const result = context.resolveRouteEdges(route);
    expect(result[0].accessibilityReasons).toEqual(['not-reviewed']);
    expect(result[0].accessibilityUnknowns).toEqual(['width']);
    expect(result[0].geometry).toEqual([[1, 0, 0], [0, 0, 0]]);
    result[0].accessibilityReasons?.push('result-change');
    result[0].accessibilityUnknowns?.push('result-change');
    result[0].geometry[0][0] = -999;
    expect(context.resolveRouteEdges(route)).toEqual([{
      ...result[0], accessibilityReasons: ['not-reviewed'], accessibilityUnknowns: ['width'], geometry: [[1, 0, 0], [0, 0, 0]],
    }]);
  });
});
