import { describe, expect, it } from 'vitest';
import type { GraphEdge, GraphNode, RoutingGraph } from '../src/graph/types';
import { validateGraph } from '../src/graph/validateGraph';

const nodesById: Record<string, GraphNode> = Object.fromEntries(
  ['a', 'b', 'c', 'd'].map((id, index) => [id, {
    id,
    x: index,
    y: 0,
    z: 0,
    floorId: 'B1',
    facilityId: 'fixture',
    kind: 'normal',
  }]),
);

const edgesById: Record<string, GraphEdge> = {
  ab: {
    id: 'ab', from: 'a', to: 'b', distanceMeters: 1, direction: 'forward', kind: 'corridor', accessibility: 'unknown', floorFrom: 'B1', floorTo: 'B1', geometry: [[0, 0, 0], [1, 0, 0]],
  },
  cd: {
    id: 'cd', from: 'c', to: 'd', distanceMeters: 1, direction: 'forward', kind: 'corridor', accessibility: 'unknown', floorFrom: 'B1', floorTo: 'B1', geometry: [[2, 0, 0], [3, 0, 0]],
  },
};

function directedFixture(nodeOrder: string[], edgeOrder: Array<keyof typeof edgesById>): RoutingGraph {
  const nodes = nodeOrder.map((id) => nodesById[id]);
  const edges = edgeOrder.map((id) => edgesById[id]);
  const adjacency: RoutingGraph['adjacency'] = Object.fromEntries(nodes.map((node) => [node.id, []]));
  for (const edge of edges) adjacency[edge.from].push(edge);
  return { nodes, edges, adjacency, rejectedEdges: [] };
}

describe('graph validation components', () => {
  it('treats reverse-ordered B, A with A to B as one weakly connected component', () => {
    const graph = directedFixture(['b', 'a'], ['ab']);

    expect(validateGraph(graph).components).toEqual([
      { id: 1, nodeIds: ['a', 'b'] },
    ]);
  });

  it('assigns stable component ids when nodes and edges are reordered', () => {
    const expected = [
      { id: 1, nodeIds: ['a', 'b'] },
      { id: 2, nodeIds: ['c', 'd'] },
    ];

    expect(validateGraph(directedFixture(['b', 'a', 'd', 'c'], ['cd', 'ab'])).components).toEqual(expected);
    expect(validateGraph(directedFixture(['d', 'c', 'b', 'a'], ['ab', 'cd'])).components).toEqual(expected);
  });

  it('excludes invalid edge endpoints from components while reporting them', () => {
    const invalidEdge: GraphEdge = {
      ...edgesById.ab,
      id: 'missing',
      to: 'missing-node',
    };
    const graph: RoutingGraph = {
      nodes: [nodesById.a, nodesById.b],
      edges: [invalidEdge],
      adjacency: { a: [invalidEdge], b: [] },
      rejectedEdges: [],
    };

    const report = validateGraph(graph);

    expect(report.components).toEqual([
      { id: 1, nodeIds: ['a'] },
      { id: 2, nodeIds: ['b'] },
    ]);
    expect(report.summary.invalidEdgeReferenceCount).toBe(1);
  });
});
