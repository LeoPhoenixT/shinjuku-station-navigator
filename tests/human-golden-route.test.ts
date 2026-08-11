import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildOfficialGraph } from '../src/graph/buildOfficialGraph';
import { admissibleHeuristicScale, astar, dijkstra } from '../src/routing/pathfinding';
import { planRoute } from '../src/routing/routeService';
import type { NamedPlacesDataset, OfficialNetworkDataset } from '../src/types/officialNetwork';
import type { HumanGoldenRouteReport } from '../scripts/build-human-golden-route.js';

const network = JSON.parse(readFileSync('public/data/processed/jr-shinjuku-ticket-gates-b1-official-network.json', 'utf8')) as OfficialNetworkDataset;
const places = JSON.parse(readFileSync('public/data/processed/shinjuku-b1-named-places.json', 'utf8')) as NamedPlacesDataset;
const golden = JSON.parse(readFileSync('reports/human-golden-route.json', 'utf8')) as HumanGoldenRouteReport;

describe('Phase 5A human-named golden route', () => {
  it('pins the established official-network topology and journey costs', () => {
    expect(golden.route.nodeIds).toEqual([
      '2c08d723e5284c0c8a3ce62beeddd551',
      '0d8c7c2fe19d4eae9a2eab756228728d',
      '98f6e89a1721488483da80457955d235',
      'fc042f06927a42f1baa8564be2dfa0e5',
    ]);
    expect(golden.route.edgeIds).toEqual([
      '74c799b0f59247af82131c30b44060b3',
      'e1383e0598c84081860c7648bb61b82f',
      'eca7838699c843f6bd4599d70f6ba472',
    ]);
    expect(golden.route).toMatchObject({ networkDistanceMeters: 30.1, accessDistanceMeters: 11.601, totalJourneyDistanceMeters: 41.701 });
    expect(golden.expandedCoverageFixture.networkDistanceMeters).toBe(306.805);
    expect(golden.multiFloorFixture).toMatchObject({ connectorEdgeIds: ['6e09f033cda0472cb754fef74c313d83'], connectorKinds: ['elevator'], networkDistanceMeters: 34.373 });
  });

  it('routes between two named gates over official links', () => {
    expect(golden.start.name).toBe('西口地下改札');
    expect(golden.destination.name).toBe('中央西改札');
    expect(golden.route.nodeIds.length).toBeGreaterThan(1);
    expect(golden.route.edgeIds.length).toBe(golden.route.nodeIds.length - 1);
    expect(golden.route.networkDistanceMeters).toBeGreaterThan(0);
  });

  it('makes A* agree with Dijkstra for the place attachments', () => {
    const graph = buildOfficialGraph(network);
    const start = places.places.find(({ id }) => id === golden.start.placeId)!;
    const end = places.places.find(({ id }) => id === golden.destination.placeId)!;
    expect(astar(graph, start.access.nodeId, end.access.nodeId)?.totalCost).toBe(dijkstra(graph, start.access.nodeId, end.access.nodeId)?.totalCost);
  });

  it('uses an admissible heuristic and matches Dijkstra for deterministic full-network samples', () => {
    const graph = buildOfficialGraph(network);
    expect(admissibleHeuristicScale(graph)).toBeGreaterThan(0);
    expect(admissibleHeuristicScale(graph)).toBeLessThanOrEqual(1);
    const stride = Math.max(1, Math.floor(graph.nodes.length / 32));
    const samples = graph.nodes.filter((_, index) => index % stride === 0).slice(0, 32);
    for (const start of samples) {
      for (const destination of samples) {
        expect(astar(graph, start.id, destination.id)?.totalCost ?? null).toBe(dijkstra(graph, start.id, destination.id)?.totalCost ?? null);
      }
    }
  }, 20_000);

  it('uses geometry length rather than free travel for zero-distance source links', () => {
    const graph = buildOfficialGraph(network);
    const zeroDistanceEdges = network.edges.filter(({ distanceMeters }) => distanceMeters === 0);
    expect(zeroDistanceEdges.length).toBeGreaterThan(0);
    for (const sourceEdge of zeroDistanceEdges) {
      expect(graph.edges.find(({ id }) => id === sourceEdge.id)?.distanceMeters).toBe(sourceEdge.geometryDistanceMeters);
      expect(sourceEdge.geometryDistanceMeters).toBeGreaterThan(0);
    }
  });

  it('routes a named request that was outside the former bounded extraction', () => {
    const graph = buildOfficialGraph(network);
    const from = places.places.find(({ id }) => id === golden.expandedCoverageFixture.fromPlaceId)!;
    const to = places.places.find(({ id }) => id === golden.expandedCoverageFixture.toPlaceId)!;
    expect(from.name).toBe('西口地下改札');
    expect(to.name).toBe('中央東改札');
    expect(planRoute(network, graph, places.places, from.id, to.id).status).toBe('ok');
    expect(golden.expandedCoverageFixture.networkDistanceMeters).toBeGreaterThan(0);
  });

  it('includes explicit place access legs and rejects low-confidence destinations', () => {
    const graph = buildOfficialGraph(network);
    const route = planRoute(network, graph, places.places, golden.start.placeId, golden.destination.placeId);
    expect(route.status).toBe('ok');
    if (route.status === 'ok') {
      expect(route.legs.map(({ kind }) => kind)).toEqual(['start-access', 'network', 'destination-access']);
      expect(route.totalDistanceMeters).toBe(route.network.distanceMeters + route.accessDistanceMeters);
    }
    const lowConfidence = places.places.find(({ routable }) => !routable)!;
    expect(planRoute(network, graph, places.places, golden.start.placeId, lowConfidence.id)).toEqual({ status: 'invalid-place', placeId: lowConfidence.id, reason: 'low-confidence-attachment' });
  });

  it('routes representative promoted Facility categories with measured access legs', () => {
    expect(golden.facilityFixtures.map(({ category }) => category)).toEqual(['toilet', 'information', 'locker']);
    const graph = buildOfficialGraph(network);
    for (const fixture of golden.facilityFixtures) {
      const place = places.places.find(({ id }) => id === fixture.placeId)!;
      const route = planRoute(network, graph, places.places, golden.start.placeId, place.id);
      expect(route.status).toBe('ok');
      expect(place.sourceCategoryCode).toBe(fixture.sourceCategoryCode);
      expect(fixture.attachmentDistanceMeters).toBe(place.access.distanceMeters);
      expect(fixture.totalJourneyDistanceMeters).toBeGreaterThanOrEqual(fixture.attachmentDistanceMeters);
    }
  });
});
