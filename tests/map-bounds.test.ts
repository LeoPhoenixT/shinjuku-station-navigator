import { describe, expect, it } from 'vitest';
import { boundsForRoute, boundsForRouteStep, type MapBounds } from '../src/map/mapBounds';
import type { RoutePlan } from '../src/routing/routeService';
import type { RoutingGraph } from '../src/graph/types';
import type { NamedPlaceRecord } from '../src/schema/processed';

const fallback: MapBounds = { minX: -100, minY: -5, minZ: -100, maxX: 100, maxY: 5, maxZ: 100 };
const place = (id: string, x: number): NamedPlaceRecord => ({ id, sourceId: id, sourceFacility: 'JR', sourceFile: 'fixture', sourceRecord: 1, name: id, category: 'gate', floorId: 'B1', coordinates: [x, -5, 0], routable: true, access: { nodeId: id, distanceMeters: 1, confidence: 'high', reviewStatus: 'automatic', accessibility: 'unknown', componentId: 0, geometry: [[x, -5, 0], [x + 1, -5, 0]] } });
const route: RoutePlan = { status: 'ok', start: place('start', 0), destination: place('end', 20), profile: 'shortest', warnings: [], steps: [{ kind: 'continue', distanceMeters: 20, floorFrom: 'B1', floorTo: 'B1', edgeIds: ['edge'] }], network: { nodeIds: ['start', 'end'], edgeIds: ['edge'], distanceMeters: 20, totalCost: 20 }, accessDistanceMeters: 2, totalDistanceMeters: 22, legs: [{ kind: 'network', geometry: [[0, -5, 0], [20, -5, 0]] }] };
const graph: RoutingGraph = { nodes: [], edges: [{ id: 'edge', from: 'start', to: 'end', distanceMeters: 20, direction: 'both', kind: 'corridor', accessibility: 'unknown', floorFrom: 'B1', floorTo: 'B1', geometry: [[0, -5, 0], [20, -5, 0]] }], adjacency: {}, rejectedEdges: [] };

describe('route-focused camera bounds', () => {
  it('fits route geometry with readable horizontal padding', () => {
    expect(boundsForRoute(route, fallback)).toMatchObject({ minX: -18, maxX: 38, minZ: -18, maxZ: 18 });
  });

  it('fits a selected instruction more tightly than the full station', () => {
    expect(boundsForRouteStep(route, graph, 0, fallback)).toMatchObject({ minX: -10, maxX: 30, minZ: -10, maxZ: 10 });
    expect(boundsForRouteStep(route, graph, undefined, fallback)).toBeUndefined();
  });
});
