import { describe, expect, it } from 'vitest';
import { buildMapLegendItems, groupMapLegendItems } from '../src/map/mapLegend';
import type { FacilityMarkerCandidate } from '../src/map/facilityMarkers';
import type { NamedPlaceRecord } from '../src/schema/processed';
import type { ProcessedFeature } from '../src/types/processed';

const feature = (id: string, layer: ProcessedFeature['layer'], floorId: string, properties: Record<string, unknown> = {}): ProcessedFeature => ({
  id, sourceId: id, sourceRecord: 1, layer, floorId, properties,
  geometry: { type: layer === 'Facility' ? 'Point' : 'PolyLine', ...(layer === 'Facility' ? { coordinates: [0, 0, 0] } : { parts: [[[0, 0, 0], [1, 0, 1]]] }) } as ProcessedFeature['geometry'],
});

const place = (id: string, floorId: string): NamedPlaceRecord => ({
  id, sourceId: id, sourceFacility: 'fixture', sourceFile: 'fixture', sourceRecord: 1, name: id, category: 'gate', floorId, coordinates: [0, 0, 0], routable: true,
  access: { nodeId: id, distanceMeters: 0, confidence: 'high', reviewStatus: 'reviewed', accessibility: 'unknown', componentId: 0, geometry: [[0, 0, 0], [0, 0, 0]] },
});

const marker: FacilityMarkerCandidate = {
  id: 'marker', sourceId: 'marker', sourceRecord: 1, sourceFacility: 'fixture', categoryCode: 'F012', categoryName: 'Elevator', label: 'Elevator', icon: 'EL', floorId: 'B1',
  coordinates: [0, -5, 0], priority: 1, minZoom: 0, status: 'public', alignmentNodeId: 'n1', alignmentDistanceMeters: 1,
};

const route = {
  status: 'ok' as const, start: place('start', 'B1'), destination: place('destination', '0'), profile: 'shortest' as const, warnings: [],
  steps: [
    { kind: 'continue' as const, distanceMeters: 2, floorFrom: 'B1', floorTo: 'B1', edgeIds: ['a'] },
    { kind: 'transition' as const, distanceMeters: 3, floorFrom: 'B1', floorTo: '0', edgeIds: ['b'] },
  ],
  network: { nodeIds: ['a', 'b'], edgeIds: ['a'], distanceMeters: 5, totalCost: 5 }, accessDistanceMeters: 0, totalDistanceMeters: 5, legs: [],
};

function items(overrides: Partial<Parameters<typeof buildMapLegendItems>[0]> = {}) {
  return buildMapLegendItems({
    features: [feature('walkway', 'Space', 'B1', { category: 'B029' }), feature('restricted', 'Space', 'B1', { category: 'B026' }), feature('opening', 'Opening', 'B1'), feature('drawing', 'Drawing', 'B1'), feature('twsi', 'TWSI_Line', 'B1')],
    facilityCandidates: [marker], places: [route.start, route.destination], visibleFloors: ['B1'], route, startId: 'start', destinationId: 'destination',
    showFacilities: true, showStructuralDetails: true, showOfficialNetwork: false, networkContexts: ['inside', 'boundary', 'outside'], hasOneWayNetwork: true, debug: false, showTwsi: false, ...overrides,
  });
}

describe('dynamic map legend', () => {
  it('describes only semantic groups, endpoints, and layers visible on selected floors', () => {
    const result = items({ visibleFloors: ['B1', '0'] });
    expect(result.map(({ id }) => id)).toEqual(expect.arrayContaining(['route', 'transition', 'start', 'destination', 'space:walkway', 'space:restricted', 'facility:F012', 'opening', 'drawing']));
    expect(result.find(({ id }) => id === 'space:restricted')).toMatchObject({ label: 'Restricted / non-public', emphasis: 'restricted' });
  });

  it('removes disabled layers and adds network and debug keys only when those layers are enabled', () => {
    const result = items({ showFacilities: false, showStructuralDetails: false, showOfficialNetwork: true, debug: true, showAllSourceLinks: true, showTwsi: true });
    expect(result.some(({ section }) => section === 'facilities')).toBe(false);
    expect(result.map(({ id }) => id)).not.toContain('drawing');
    expect(result.map(({ id }) => id)).toEqual(expect.arrayContaining(['network:inside', 'network:boundary', 'network:outside', 'network:one-way', 'network:all-source', 'twsi']));
  });

  it('responds to floor changes and returns deterministic section ordering', () => {
    const result = items({ visibleFloors: ['0'] });
    expect(result.map(({ id }) => id)).toEqual(['destination']);
    expect(groupMapLegendItems(items()).map(({ section }) => section)).toEqual(['route', 'spaces', 'facilities', 'structure']);
  });
});
