import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildOfficialGraph } from '../src/graph/buildOfficialGraph';
import { mergeReviewedCustomGraph } from '../src/graph/buildReviewedCustomGraph';
import { planRoute } from '../src/routing/routeService';
import { formatRouteInstruction, formatRouteWarning } from '../src/i18n/formatters';
import { parseNamedPlaces, parseOfficialNetwork } from '../src/schema/processed';
import { parseReviewedCustomNetwork } from '../src/schema/reviewedCustomNetwork';

const network = parseOfficialNetwork(JSON.parse(readFileSync('public/data/processed/jr-shinjuku-ticket-gates-b1-official-network.json', 'utf8')) as unknown);
const reviewedNetwork = parseReviewedCustomNetwork(JSON.parse(readFileSync('public/data/processed/shinjuku-reviewed-custom-network.json', 'utf8')) as unknown, network);
const places = parseNamedPlaces(JSON.parse(readFileSync('public/data/processed/shinjuku-b1-named-places.json', 'utf8')) as unknown, network, reviewedNetwork).places;
const graph = mergeReviewedCustomGraph(buildOfficialGraph(network), reviewedNetwork);

describe('consumer route service', () => {
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
