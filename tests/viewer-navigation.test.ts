import { readFileSync } from 'node:fs';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildAdjacency } from '../src/graph/adjacency.js';
import type { GraphEdge, RoutingGraph } from '../src/graph/types.js';
import { useViewerNavigation } from '../src/hooks/useViewerNavigation.js';
import { boundsForFloors, boundsForRoute, boundsForRouteStep } from '../src/map/mapBounds.js';
import type { RoutePlan } from '../src/routing/routeService.js';
import { parseFloorDataset } from '../src/schema/processed.js';
import { places } from './fixtures/places.js';

const floor = parseFloorDataset(JSON.parse(readFileSync('public/data/processed/shinjuku-full-map.json', 'utf8')) as unknown);
const nodes: RoutingGraph['nodes'] = [
  { id: 'a', x: 0, y: -5, z: 0, floorId: 'B1', facilityId: 'fixture', kind: 'normal' },
  { id: 'b', x: 10, y: 0, z: 0, floorId: '0', facilityId: 'fixture', kind: 'elevator' },
];
const edges: GraphEdge[] = [{ id: 'ab', from: 'a', to: 'b', distanceMeters: 12, direction: 'both', kind: 'elevator', accessibility: 'yes', floorFrom: 'B1', floorTo: '0', geometry: [[0, -5, 0], [10, 0, 0]] }];
const graph: RoutingGraph = { nodes, edges, adjacency: buildAdjacency(nodes, edges), rejectedEdges: [] };
const route: RoutePlan = {
  status: 'ok', start: places[0], destination: places[1], profile: 'shortest', warnings: [],
  steps: [{ kind: 'transition', floorFrom: 'B1', floorTo: '0', movement: 'elevator', distanceMeters: 12, edgeIds: ['ab'] }],
  network: { nodeIds: ['a', 'b'], edgeIds: ['ab'], distanceMeters: 12, totalCost: 12 },
  accessDistanceMeters: 0, totalDistanceMeters: 12, legs: [{ kind: 'network', geometry: edges[0].geometry }],
};
const input = { floor, graph, floorIds: ['B1', '0'], allFloorIds: ['B1', '0'], notify: vi.fn() };
const cleared: RoutePlan = { status: 'invalid-place', placeId: '', reason: 'not-found' };

function setup() {
  return renderHook(({ selectedRoute }: { selectedRoute: RoutePlan }) => useViewerNavigation({ ...input, route: selectedRoute }), { initialProps: { selectedRoute: route } });
}

function expectNoStep(navigation: ReturnType<typeof useViewerNavigation>) {
  expect(navigation.selectedStepIndex).toBeUndefined();
  expect(navigation.highlightedEdgeIds).toEqual([]);
  expect(navigation.zoomMultiplier).toBe(1);
}

describe('viewer navigation sequences', () => {
  it('reveals a hidden step floor, then resets focus when selecting a floor and clearing the route', () => {
    const { result, rerender } = setup();
    act(() => result.current.toggleCustomFloor('0'));
    expect(result.current.visibleFloors).toEqual(['B1']);
    act(() => result.current.zoomIn());
    const revision = result.current.cameraRevision;
    act(() => result.current.selectStep(0));
    expect(result.current.visibleFloors).toEqual(['B1', '0']);
    expect(result.current.activeFloor).toBe('0');
    expect(result.current.selectedStepIndex).toBe(0);
    expect(result.current.highlightedEdgeIds).toEqual(['ab']);
    expect(result.current.zoomMultiplier).toBe(1);
    expect(result.current.cameraRevision).toBe(revision + 1);
    expect(result.current.cameraBounds).toEqual(boundsForRouteStep(route, graph, 0, floor.statistics.bounds));

    act(() => result.current.zoomIn());
    act(() => result.current.selectFloor('B1'));
    expectNoStep(result.current);
    expect(result.current.floorViewMode).toBe('focused');
    expect(result.current.activeFloor).toBe('B1');
    expect(result.current.cameraBounds).toEqual(boundsForFloors(floor, ['B1', '0']));

    act(() => result.current.selectStep(0));
    act(() => result.current.zoomIn());
    act(() => result.current.resetAfterRouteClear());
    // The immediate clear action only removes step focus. The route-change effect resets zoom.
    expect(result.current.selectedStepIndex).toBeUndefined();
    expect(result.current.zoomMultiplier).toBe(1.25);
    rerender({ selectedRoute: cleared });
    expectNoStep(result.current);
    expect(result.current.cameraBounds).toEqual(boundsForFloors(floor, ['B1', '0']));
    act(() => result.current.selectStep(0));
    expectNoStep(result.current);
  });

  it('resets selected steps and zoom for fit, stack, route-floor, and custom-floor actions', () => {
    const { result } = setup();
    for (const action of ['fitRoute', 'fitStation', 'showStack', 'showRouteFloors'] as const) {
      act(() => result.current.selectStep(0));
      act(() => result.current.zoomIn());
      const revision = result.current.cameraRevision;
      act(() => result.current[action]());
      expectNoStep(result.current);
      expect(result.current.cameraRevision).toBe(revision + 1);
      const visible = boundsForFloors(floor, result.current.visibleFloors);
      expect(result.current.cameraBounds).toEqual(action === 'fitStation' ? visible : boundsForRoute(route, visible));
    }
    act(() => result.current.selectStep(0));
    act(() => result.current.toggleCustomFloor('0'));
    expectNoStep(result.current);
    expect(result.current.visibleFloors).toEqual(['B1']);
    expect(result.current.cameraOrientation).toBe('north');
    act(() => result.current.toggleCustomFloor('B1'));
    expect(result.current.visibleFloors).toEqual(['B1']);
    expect(input.notify).toHaveBeenCalledOnce();
  });
});
