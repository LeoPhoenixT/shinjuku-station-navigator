import { describe, expect, it } from 'vitest';
import { findNearestRoutablePlace, groupPlacesByFloorArea, normalizePlaceQuery, placeDisplayName, searchPlaces } from '../src/features/route-planner/placeSearch';
import { readRouteUrl, ROUTE_PROFILE, writeRouteUrl } from '../src/features/route-planner/routeUrlState';
import type { NamedPlaceRecord } from '../src/schema/processed';
import { publicPlaceName } from '../src/places/placePresentation';

const places: NamedPlaceRecord[] = [
  { id: 'gate:a', sourceId: 'a', sourceFacility: 'JR', sourceFile: 'a', sourceRecord: 1, sourceLayer: 'Opening', sourceCategoryCode: 'Opening', name: '中央東改札', aliases: ['Central East Gate'], category: 'gate', floorId: 'B1', coordinates: [0, -5, 0], routable: true, access: { nodeId: 'n1', distanceMeters: 1.2, confidence: 'high', reviewStatus: 'automatic', accessibility: 'unknown', componentId: 0, geometry: [[0, -5, 0], [1, -5, 0]] } },
  { id: 'gate:b', sourceId: 'b', sourceFacility: 'Keio', sourceFile: 'b', sourceRecord: 2, sourceLayer: 'Opening', sourceCategoryCode: 'Opening', name: '京王西口', category: 'gate', floorId: 'B1', coordinates: [10, -5, 0], routable: true, access: { nodeId: 'n2', distanceMeters: 2, confidence: 'high', reviewStatus: 'automatic', accessibility: 'unknown', componentId: 0, geometry: [[10, -5, 0], [9, -5, 0]] } },
  { id: 'gate:low', sourceId: 'low', sourceFacility: 'JR', sourceFile: 'c', sourceRecord: 3, sourceLayer: 'Opening', sourceCategoryCode: 'Opening', name: 'Review gate', category: 'gate', floorId: 'B1', coordinates: [1, -5, 0], routable: false, access: { nodeId: 'n3', distanceMeters: 20, confidence: 'low', reviewStatus: 'automatic', accessibility: 'unknown', componentId: 0, geometry: [[1, -5, 0], [2, -5, 0]] } },
];

describe('Phase 6 place interaction', () => {
  it('searches names, facilities, and aliases with normalized text', () => {
    expect(normalizePlaceQuery('  CENTRAL   East ')).toBe('central east');
    expect(searchPlaces(places, 'central east').map(({ id }) => id)).toEqual(['gate:a']);
    expect(searchPlaces(places, 'Keio').map(({ id }) => id)).toEqual(['gate:b']);
    expect(placeDisplayName(places[0])).toContain('中央東改札 · JR');
  });

  it('selects the nearest routable place within tolerance with stable tie-breaking', () => {
    expect(findNearestRoutablePlace(places, [0.5, 0], 2)?.id).toBe('gate:a');
    expect(findNearestRoutablePlace(places, [100, 100], 15)).toBeUndefined();
  });

  it('groups place results by floor elevation and source area', () => {
    const upper = { ...places[1], id: 'gate:upper', floorId: '0', sourceFacility: 'Metro' };
    const groups = groupPlacesByFloorArea([...places, upper]);
    expect(groups.map(({ floorId, area }) => `${floorId}:${area}`)).toEqual(['B1:JR', 'B1:Keio', '0:Metro']);
    expect(groups[0].places.map(({ id }) => id)).toEqual(['gate:low', 'gate:a']);
  });

  it('groups dense results by category as well as floor and source area', () => {
    const toilet: NamedPlaceRecord = { ...places[0], id: 'facility:toilet', category: 'toilet', sourceLayer: 'Facility', sourceCategoryCode: 'F001', name: 'トイレ（男性）' };
    expect(groupPlacesByFloorArea([places[0], toilet]).map(({ category }) => category)).toEqual(['gate', 'toilet']);
    expect(searchPlaces([toilet], 'Lavatory')).toEqual([]);
    expect(searchPlaces([{ ...toilet, aliases: ['Lavatory (Male)'] }], 'lavatory')).toHaveLength(1);
  });

  it('replaces technical connector codes with source-backed category and floor labels', () => {
    const technical: NamedPlaceRecord = { ...places[0], name: 'ESC_K9-2', nameKind: 'generated-descriptive', category: 'escalator', floorId: '3' };
    expect(publicPlaceName(technical)).toBe('Escalator · 3');
    expect(placeDisplayName(technical)).toContain('Escalator · 3 · JR');
  });
});

describe('Phase 6 route URL state', () => {
  it('restores stable place IDs and the shortest profile', () => {
    const search = writeRouteUrl({ startId: 'gate:a', destinationId: 'gate:b', profile: ROUTE_PROFILE });
    expect(readRouteUrl(search, ['fallback-a', 'fallback-b'])).toEqual({ startId: 'gate:a', destinationId: 'gate:b', profile: 'shortest' });
  });

  it('falls back safely when parameters or profiles are absent or unsupported', () => {
    expect(readRouteUrl('?profile=unknown', ['gate:a', 'gate:b'])).toEqual({ startId: 'gate:a', destinationId: 'gate:b', profile: 'shortest' });
  });
});
