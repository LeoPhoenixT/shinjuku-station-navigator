import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildGraphFromProcessedData } from '../src/graph/buildGraph';
import type { RoutingGraph } from '../src/graph/types';
import { validateGraph } from '../src/graph/validateGraph';
import { astar, dijkstra } from '../src/routing/pathfinding';
import { benchmarkRoute } from '../src/routing/benchmark';
import type { ProcessedDataset } from '../src/types/processed';

const dataset = JSON.parse(readFileSync('public/data/processed/jr-shinjuku-ticket-gates-b1.json', 'utf8')) as ProcessedDataset;
const fullMap = JSON.parse(readFileSync('public/data/processed/shinjuku-full-map.json', 'utf8')) as ProcessedDataset;

function fixtureGraph(): RoutingGraph {
  const nodes = [
    { id: 'a', x: 0, y: 0, z: 0, floorId: 'B1', facilityId: 'fixture', kind: 'normal' as const },
    { id: 'b', x: 1, y: 0, z: 0, floorId: 'B1', facilityId: 'fixture', kind: 'normal' as const },
    { id: 'c', x: 2, y: 0, z: 0, floorId: 'B1', facilityId: 'fixture', kind: 'normal' as const },
    { id: 'd', x: 0, y: 4, z: 0, floorId: '1', facilityId: 'fixture', kind: 'elevator' as const },
    { id: 'isolated', x: 99, y: 0, z: 0, floorId: 'B1', facilityId: 'fixture', kind: 'normal' as const },
  ];
  const edges = [
    { id: 'ab', from: 'a', to: 'b', distanceMeters: 1, direction: 'both' as const, kind: 'corridor' as const, accessibility: 'unknown' as const, floorFrom: 'B1', floorTo: 'B1', geometry: [[0, 0, 0], [1, 0, 0]] as Array<[number, number, number]> },
    { id: 'bc', from: 'b', to: 'c', distanceMeters: 1, direction: 'forward' as const, kind: 'corridor' as const, accessibility: 'yes' as const, floorFrom: 'B1', floorTo: 'B1', geometry: [[1, 0, 0], [2, 0, 0]] as Array<[number, number, number]> },
    { id: 'ad', from: 'a', to: 'd', distanceMeters: 4, direction: 'both' as const, kind: 'elevator' as const, accessibility: 'yes' as const, floorFrom: 'B1', floorTo: '1', geometry: [[0, 0, 0], [0, 4, 0]] as Array<[number, number, number]> },
  ];
  return {
    nodes,
    edges,
    rejectedEdges: [],
    adjacency: {
      a: [edges[0], edges[2]],
      b: [edges[0], edges[1]],
      c: [],
      d: [{ ...edges[2], id: 'ad:reverse', from: 'd', to: 'a', geometry: [...edges[2].geometry].reverse() }],
      isolated: [],
    },
  };
}

describe('Phase 3 graph construction and validation', () => {
  it('builds a same-floor TWSI graph from processed data and reports rejected source references', () => {
    const graph = buildGraphFromProcessedData(dataset);
    const report = validateGraph(graph);
    expect(graph.nodes).toHaveLength(12);
    expect(graph.nodes.every((node) => node.name === undefined)).toBe(true);
    expect(graph.edges).toHaveLength(10);
    expect(graph.rejectedEdges).toHaveLength(5);
    expect(Object.keys(graph.adjacency)).toHaveLength(12);
    expect(report.valid).toBe(false);
    expect(report.summary.invalidEdgeReferenceCount).toBe(5);
    expect(report.summary.connectedComponentCount).toBe(2);
    expect(report.summary.isolatedNodeCount).toBe(1);
    expect(report.summary.accessibilityCounts.unknown).toBe(10);
  });

  it('qualifies full-map TWSI IDs by source area and preserves feature floors', () => {
    const graph = buildGraphFromProcessedData(fullMap);
    expect(graph.nodes).toHaveLength(371);
    expect(new Set(graph.nodes.map(({ id }) => id)).size).toBe(graph.nodes.length);
    expect(graph.edges.length).toBeGreaterThan(0);
    expect(new Set(graph.edges.map(({ id }) => id)).size).toBe(graph.edges.length);
    expect(new Set(graph.nodes.map(({ floorId }) => floorId))).toEqual(new Set(['B3', 'B2', 'B1', '0', '2']));
    expect(graph.nodes.every(({ id }) => id.includes(':'))).toBe(true);
  });

  it('summarizes one-way edges, vertical connectors, isolated nodes, and accessibility on synthetic fixtures', () => {
    const report = validateGraph(fixtureGraph());
    expect(report.valid).toBe(true);
    expect(report.summary.oneWayEdgeCount).toBe(1);
    expect(report.summary.verticalConnectorCountByType.elevator).toBe(1);
    expect(report.isolatedNodeIds).toEqual(['isolated']);
    expect(report.summary.accessibilityCounts).toEqual({ yes: 2, no: 0, unknown: 1 });
  });
});

describe('Phase 4 pathfinding', () => {
  it('finds a deterministic real-data route and A* matches Dijkstra', () => {
    const graph = buildGraphFromProcessedData(dataset);
    const start = '00a0841febd544c3b111f0816e3983c1';
    const goal = 'ec158ffc1a9f42dc9d15ba3ce27d051c';
    const route = dijkstra(graph, start, goal);
    const oracle = astar(graph, start, goal);
    expect(route).not.toBeNull();
    expect(route?.nodeIds[0]).toBe(start);
    expect(route?.nodeIds.at(-1)).toBe(goal);
    expect(route?.distanceMeters).toBe(43.768);
    expect(oracle?.totalCost).toBe(route?.totalCost);
  });

  it('handles unreachable destinations and one-way restrictions on synthetic fixtures', () => {
    const graph = fixtureGraph();
    expect(dijkstra(graph, 'isolated', 'a')).toBeNull();
    expect(dijkstra(graph, 'c', 'a')).toBeNull();
    expect(astar(graph, 'a', 'c')?.nodeIds).toEqual(['a', 'b', 'c']);
  });

  it('supports a multi-floor synthetic route and measures route latency', () => {
    const graph = fixtureGraph();
    const route = astar(graph, 'd', 'b');
    const benchmark = benchmarkRoute(graph, 'd', 'b', 20);
    expect(route?.nodeIds).toEqual(['d', 'a', 'b']);
    expect(route?.distanceMeters).toBe(5);
    expect(benchmark.lastRouteDistanceMeters).toBe(5);
    expect(benchmark.averageMilliseconds).toBeLessThan(100);
  });
});

function profileGraph(): RoutingGraph {
  const nodes = [
    { id: 's', x: 0, y: 0, z: 0, floorId: 'B1', facilityId: 'fixture', kind: 'normal' as const },
    { id: 'stairs', x: 1, y: 1, z: 0, floorId: '0', facilityId: 'fixture', kind: 'stairs' as const },
    { id: 'lift', x: 4, y: 1, z: 0, floorId: '0', facilityId: 'fixture', kind: 'elevator' as const },
    { id: 'g', x: 2, y: 1, z: 0, floorId: '0', facilityId: 'fixture', kind: 'normal' as const },
  ];
  const edges = [
    { id: 'short-stairs', from: 's', to: 'stairs', distanceMeters: 1, direction: 'both' as const, kind: 'stairs' as const, accessibility: 'no' as const, floorFrom: 'B1', floorTo: '0', geometry: [[0, 0, 0], [1, 1, 0]] as Array<[number, number, number]> },
    { id: 'stairs-goal', from: 'stairs', to: 'g', distanceMeters: 1, direction: 'both' as const, kind: 'corridor' as const, accessibility: 'yes' as const, floorFrom: '0', floorTo: '0', geometry: [[1, 1, 0], [2, 1, 0]] as Array<[number, number, number]> },
    { id: 'accessible-lift', from: 's', to: 'lift', distanceMeters: 4, direction: 'both' as const, kind: 'elevator' as const, accessibility: 'yes' as const, floorFrom: 'B1', floorTo: '0', geometry: [[0, 0, 0], [4, 1, 0]] as Array<[number, number, number]> },
    { id: 'lift-goal', from: 'lift', to: 'g', distanceMeters: 4, direction: 'both' as const, kind: 'corridor' as const, accessibility: 'unknown' as const, accessibilityUnknowns: ['width'], floorFrom: '0', floorTo: '0', geometry: [[4, 1, 0], [2, 1, 0]] as Array<[number, number, number]> },
  ];
  const adjacency: RoutingGraph['adjacency'] = Object.fromEntries(nodes.map(({ id }) => [id, []]));
  for (const edge of edges) {
    adjacency[edge.from].push(edge);
    adjacency[edge.to].push({ ...edge, id: `${edge.id}:reverse`, from: edge.to, to: edge.from, geometry: [...edge.geometry].reverse() });
  }
  return { nodes, edges, adjacency, rejectedEdges: [] };
}

describe('Phase 8 routing profiles', () => {
  it('excludes known inaccessible and stair edges while allowing disclosed unknown accessibility', () => {
    expect(astar(profileGraph(), 's', 'g')?.edgeIds).toEqual(['short-stairs', 'stairs-goal']);
    expect(astar(profileGraph(), 's', 'g', { profile: 'accessible' })?.edgeIds).toEqual(['accessible-lift', 'lift-goal']);
    expect(astar(profileGraph(), 's', 'g', { profile: 'avoid-stairs' })?.edgeIds).toEqual(['accessible-lift', 'lift-goal']);
  });

  it('prefers elevators over a shorter non-elevator floor change', () => {
    expect(dijkstra(profileGraph(), 's', 'g', { profile: 'prefer-elevator' })?.edgeIds).toEqual(['accessible-lift', 'lift-goal']);
  });

  it('prioritizes fewer floor transitions before distance', () => {
    const graph = profileGraph();
    const secondTransition = graph.edges.find(({ id }) => id === 'stairs-goal');
    if (!secondTransition) throw new Error('Missing fixture edge.');
    secondTransition.floorTo = 'B1';
    graph.adjacency.stairs = graph.adjacency.stairs.map((edge) => edge.id === 'stairs-goal' ? { ...edge, floorTo: 'B1' } : edge);
    expect(astar(graph, 's', 'g', { profile: 'fewest-floor-changes' })?.edgeIds).toEqual(['accessible-lift', 'lift-goal']);
  });
});
