import { describe, expect, it } from 'vitest';
import { routeDirectionCues, routeLineSegmentPositions, routePolylines, routeTransitionMarkers, routeTransitionPolylines } from '../src/map/routeLineGeometry';
import { displayElevation } from '../src/map/stackedElevation';
import type { RoutingGraph } from '../src/graph/types';
import type { RoutePlan } from '../src/routing/routeService';
import type { NamedPlaceRecord } from '../src/schema/processed';

const place: NamedPlaceRecord = {
  id: 'place', sourceId: 'place', sourceFacility: 'JR', sourceFile: 'fixture', sourceRecord: 1,
  name: 'Place', category: 'gate', floorId: '2', coordinates: [0, 10, 0], routable: true,
  access: { nodeId: 'node', distanceMeters: 0, confidence: 'high', reviewStatus: 'automatic', accessibility: 'unknown', componentId: 0, geometry: [[0, 10, 0], [0, 10, 0]] },
};

const route: RoutePlan = {
  status: 'ok', start: place, destination: { ...place, id: 'destination' }, profile: 'shortest', warnings: [], steps: [],
  network: { nodeIds: ['a', 'b'], edgeIds: ['edge'], distanceMeters: 2, totalCost: 2 }, accessDistanceMeters: 0, totalDistanceMeters: 2,
  legs: [
    { kind: 'start-access', geometry: [[0, 10, 0], [1, 10, 0]] },
    { kind: 'network', geometry: [[1, 10, 0], [2, 10, 1], [3, 10, 0]] },
    { kind: 'destination-access', geometry: [[3, 10, 0], [4, 10, 0]] },
  ],
};

const multiFloorRoute: RoutePlan = {
  ...route,
  network: { nodeIds: ['b2-a', 'b2-b', 'b1-a', 'b1-b', 'g-a', 'g-b'], edgeIds: ['b2', 'b2-b1', 'b1', 'b1-g', 'g'], distanceMeters: 5, totalCost: 5 },
  legs: [{ kind: 'network', geometry: [[0, -10, 0], [1, -10, 0], [1, -5, 0], [2, -5, 0], [2, 0, 0], [3, 0, 0]] }],
};

const stackedB2Y = displayElevation(-10, true);
const stackedB1Y = displayElevation(-5, true);
const stackedGroundY = displayElevation(0, true);

const transitionGraph: RoutingGraph = {
  nodes: [], rejectedEdges: [], adjacency: {},
  edges: [
    { id: 'b2', from: 'b2-a', to: 'b2-b', distanceMeters: 10, direction: 'both', kind: 'corridor', accessibility: 'yes', floorFrom: 'B2', floorTo: 'B2', geometry: [[0, -10, 0], [1, -10, 0]] },
    { id: 'b2-b1', from: 'b2-b', to: 'b1-a', distanceMeters: 5, direction: 'both', kind: 'stairs', accessibility: 'no', floorFrom: 'B2', floorTo: 'B1', geometry: [[1, -10, 0], [1, -5, 0]] },
    { id: 'b1-g', from: 'b1-b', to: 'g-a', distanceMeters: 5, direction: 'both', kind: 'elevator', accessibility: 'yes', floorFrom: 'B1', floorTo: '0', geometry: [[2, -5, 0], [2, 0, 0]] },
  ],
};

describe('route line geometry', () => {
  it('preserves every access and official-network polyline in stacked mode', () => {
    expect(routePolylines(route, ['B1', '2'], true).map((line) => line.length)).toEqual([2, 3, 2]);
  });

  it('keeps the network leg on its selected isolated floor', () => {
    expect(routePolylines(route, ['2'], false).map((line) => line.length)).toEqual([2, 3, 2]);
    expect(routePolylines(route, ['B1'], false)).toEqual([]);
  });

  it('hides same-floor route geometry on omitted floors in a partial stack', () => {
    expect(routePolylines(multiFloorRoute, ['B2', '0'], true).map((line) => line.map((point) => point[1]))).toEqual([[stackedB2Y, stackedB2Y], [stackedGroundY, stackedGroundY]]);
  });

  it('shows a floor transition only when both endpoint floors are visible', () => {
    expect(routeTransitionPolylines(multiFloorRoute, transitionGraph, ['B2', '0'], true)).toEqual([]);
    expect(routeTransitionPolylines(multiFloorRoute, transitionGraph, ['B2', 'B1'], true)).toEqual([[[1, stackedB2Y, 0], [1, stackedB1Y, 0]]]);
  });

  it('builds independent GPU segments without bridging separate polylines', () => {
    expect(routeLineSegmentPositions([[[0, 0, 0], [1, 0, 0]], [[10, 0, 0], [11, 0, 0]]], 2)).toEqual([
      0, 2, 0, 1, 2, 0,
      10, 2, 0, 11, 2, 0,
    ]);
  });

  it('places static direction cues in traversal order and reverses them when needed', () => {
    const forward = routeDirectionCues(multiFloorRoute, transitionGraph, ['B2'], true, 0);
    expect(forward).toContainEqual({ edgeId: 'b2', position: [0.5, stackedB2Y, 0], direction: [1, 0, 0] });
    const reversedRoute: RoutePlan = { ...multiFloorRoute, network: { ...multiFloorRoute.network, nodeIds: ['b2-b', 'b2-a'], edgeIds: ['b2'] } };
    expect(routeDirectionCues(reversedRoute, transitionGraph, ['B2'], true, 0)[0]).toMatchObject({ direction: [-1, 0, 0] });
  });

  it('labels transitions using the route traversal floor order', () => {
    expect(routeTransitionMarkers(multiFloorRoute, transitionGraph, ['B2', 'B1'], true)).toContainEqual({ edgeId: 'b2-b1', position: [1, (stackedB2Y + stackedB1Y) / 2, 0], movement: 'stairs', floorFrom: 'B2', floorTo: 'B1' });
    const reversedRoute: RoutePlan = { ...multiFloorRoute, network: { ...multiFloorRoute.network, nodeIds: ['b1-a', 'b2-b'], edgeIds: ['b2-b1'] } };
    expect(routeTransitionMarkers(reversedRoute, transitionGraph, ['B2', 'B1'], true)[0]).toMatchObject({ floorFrom: 'B1', floorTo: 'B2' });
  });
});
