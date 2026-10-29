import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildOfficialGraph } from '../src/graph/buildOfficialGraph';
import { mergeReviewedCustomGraph } from '../src/graph/buildReviewedCustomGraph';
import { planRoute } from '../src/routing/routeService';
import { formatRouteInstruction, formatRouteWarning } from '../src/i18n/formatters';
import { parseNamedPlaces, parseOfficialNetwork } from '../src/schema/processed';
import { parseReviewedCustomNetwork } from '../src/schema/reviewedCustomNetwork';
import { buildAdjacency } from '../src/graph/adjacency';
import type { GraphEdge, RoutingGraph } from '../src/graph/types';
import { places as fixturePlaces } from './fixtures/places';

const network = parseOfficialNetwork(JSON.parse(readFileSync('public/data/processed/jr-shinjuku-ticket-gates-b1-official-network.json', 'utf8')) as unknown);
const reviewedNetwork = parseReviewedCustomNetwork(JSON.parse(readFileSync('public/data/processed/shinjuku-reviewed-custom-network.json', 'utf8')) as unknown, network);
const places = parseNamedPlaces(JSON.parse(readFileSync('public/data/processed/shinjuku-b1-named-places.json', 'utf8')) as unknown, network, reviewedNetwork).places;
const graph = mergeReviewedCustomGraph(buildOfficialGraph(network), reviewedNetwork);

describe('consumer route service', () => {
  it('uses reverse traversal consistently for geometry, floor instructions, and accessibility warnings', () => {
    const nodes: RoutingGraph['nodes'] = [
      { id: 'a', x: 0, y: -5, z: 0, floorId: 'B1', facilityId: 'fixture', kind: 'normal' },
      { id: 'b', x: 0, y: 0, z: 0, floorId: '0', facilityId: 'fixture', kind: 'elevator' },
    ];
    const edges: GraphEdge[] = [{ id: 'ab', from: 'a', to: 'b', distanceMeters: 5, direction: 'reverse', kind: 'elevator', accessibility: 'unknown', accessibilityUnknowns: ['width', 'elevator-equipment'], floorFrom: 'B1', floorTo: '0', geometry: [[0, -5, 0], [0, 0, 0]] }];
    const synthetic: RoutingGraph = { nodes, edges, adjacency: buildAdjacency(nodes, edges), rejectedEdges: [] };
    const endpoints = [
      { ...fixturePlaces[0], floorId: '0', access: { ...fixturePlaces[0].access, nodeId: 'b', distanceMeters: 0, accessibility: 'yes' as const } },
      { ...fixturePlaces[1], access: { ...fixturePlaces[1].access, nodeId: 'a', distanceMeters: 0, accessibility: 'yes' as const } },
    ];
    const route = planRoute(network, synthetic, endpoints, 'start', 'end', 'accessible');
    expect(route.status).toBe('ok');
    if (route.status !== 'ok') return;
    expect(route.legs.find(({ kind }) => kind === 'network')?.geometry).toEqual([[0, 0, 0], [0, -5, 0]]);
    expect(route.steps[0]).toMatchObject({ kind: 'transition', floorFrom: '0', floorTo: 'B1', edgeIds: ['ab'] });
    expect(route.warnings).toEqual([{ code: 'accessibility-fields-unknown', fields: ['elevator-equipment', 'width'] }]);
    expect(planRoute(network, synthetic, endpoints, 'end', 'start', 'accessible').status).toBe('unreachable');
  });

  it('treats an identical start and destination as immediate arrival', () => {
    const place = places.find(({ routable }) => routable);
    if (!place) throw new Error('Fixture requires a routable place.');
    const route = planRoute(network, graph, places, place.id, place.id);
    expect(route.status).toBe('ok');
    if (route.status !== 'ok') return;
    expect(route.totalDistanceMeters).toBe(0);
    expect(route.accessDistanceMeters).toBe(0);
    expect(route.legs).toEqual([]);
    expect(route.steps[0]).toMatchObject({ kind: 'arrive', alreadyThere: true });
    expect(formatRouteInstruction(route.steps[0], route.start, route.destination, 'en')).toContain('already at');
    expect(formatRouteInstruction(route.steps[0], route.start, route.destination, 'ja')).toContain('すでに');
  });

  it('discloses unknown place-access accessibility on wheelchair routes', () => {
    const candidates = places.filter(({ routable, access }) => routable && access.accessibility === 'unknown');
    let route = planRoute(network, graph, places, candidates[0].id, candidates[1].id, 'accessible');
    for (let index = 2; route.status !== 'ok' && index < candidates.length; index += 1) route = planRoute(network, graph, places, candidates[0].id, candidates[index].id, 'accessible');
    expect(route.status).toBe('ok');
    if (route.status !== 'ok') return;
    expect(route.warnings).toContainEqual(expect.objectContaining({ code: 'accessibility-access-unverified' }));
    expect(route.warnings.map((warning) => formatRouteWarning(warning, places, 'en')).join(' ')).toContain('place-to-network access');
    expect(route.warnings.map((warning) => formatRouteWarning(warning, places, 'ja')).join(' ')).toContain('歩行者ネットワーク');
  });

  it('rejects a wheelchair route when either access leg is known inaccessible', () => {
    const candidates = places.filter(({ routable }) => routable).slice(0, 2).map((place) => structuredClone(place));
    candidates[0].access.accessibility = 'no';
    expect(planRoute(network, graph, candidates, candidates[0].id, candidates[1].id, 'accessible')).toMatchObject({ status: 'unreachable', reason: 'no-accessible-path' });
  });
});
