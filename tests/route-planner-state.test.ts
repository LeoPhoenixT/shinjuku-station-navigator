import { readFileSync } from 'node:fs';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRoutePlanner } from '../src/features/route-planner/useRoutePlanner';
import { buildOfficialGraph } from '../src/graph/buildOfficialGraph';
import { mergeReviewedCustomGraph } from '../src/graph/buildReviewedCustomGraph';
import { parseNamedPlaces, parseOfficialNetwork } from '../src/schema/processed';
import { parseReviewedCustomNetwork } from '../src/schema/reviewedCustomNetwork';

const network = parseOfficialNetwork(JSON.parse(readFileSync('public/data/processed/jr-shinjuku-ticket-gates-b1-official-network.json', 'utf8')) as unknown);
const reviewedNetwork = parseReviewedCustomNetwork(JSON.parse(readFileSync('public/data/processed/shinjuku-reviewed-custom-network.json', 'utf8')) as unknown, network);
const places = parseNamedPlaces(JSON.parse(readFileSync('public/data/processed/shinjuku-b1-named-places.json', 'utf8')) as unknown, network, reviewedNetwork).places;
const graph = mergeReviewedCustomGraph(buildOfficialGraph(network), reviewedNetwork);
const candidates = places.filter(({ routable, access }) => routable && access.componentId === 0).slice(0, 3);

describe('route planner submitted state', () => {
  beforeEach(() => window.history.replaceState(null, '', `/?start=${encodeURIComponent(candidates[0].id)}&destination=${encodeURIComponent(candidates[1].id)}&profile=shortest`));

  it('keeps draft edits out of the active route and URL until submission', () => {
    const { result } = renderHook(() => useRoutePlanner(network, graph, places));
    expect(result.current.route.status).toBe('ok');
    act(() => result.current.setDestinationId(candidates[2].id));
    expect(result.current.destinationId).toBe(candidates[2].id);
    expect(result.current.routeDirty).toBe(true);
    expect(new URLSearchParams(window.location.search).get('destination')).toBe(candidates[1].id);
    if (result.current.route.status === 'ok') expect(result.current.route.destination.id).toBe(candidates[1].id);

    act(() => result.current.submitRoute());
    expect(result.current.routeDirty).toBe(false);
    expect(new URLSearchParams(window.location.search).get('destination')).toBe(candidates[2].id);
    if (result.current.route.status === 'ok') expect(result.current.route.destination.id).toBe(candidates[2].id);
  });

  it('applies a facility Route here action as one submitted journey update', () => {
    const { result } = renderHook(() => useRoutePlanner(network, graph, places));
    act(() => result.current.routeToDestination(candidates[2].id));
    expect(result.current.routeDirty).toBe(false);
    expect(new URLSearchParams(window.location.search).get('destination')).toBe(candidates[2].id);
    if (result.current.route.status === 'ok') expect(result.current.route.destination.id).toBe(candidates[2].id);
  });

  it('starts without an invented demo route when the URL has no endpoints', () => {
    window.history.replaceState(null, '', '/');
    const { result } = renderHook(() => useRoutePlanner(network, graph, places));
    expect(result.current.startId).toBe('');
    expect(result.current.destinationId).toBe('');
    expect(result.current.route.status).toBe('invalid-place');
  });
});
