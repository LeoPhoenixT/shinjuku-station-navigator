import { describe, expect, it } from 'vitest';
import { estimateJourney, estimatedTimeText, TRANSITION_ALLOWANCE_SECONDS, WALKING_SPEED_METERS_PER_SECOND } from '../src/routing/journeyEstimate';
import type { RoutePlan } from '../src/routing/routeService';
import type { NamedPlaceRecord } from '../src/schema/processed';

const place: NamedPlaceRecord = {
  id: 'place', sourceId: 'source', sourceFacility: 'JR', sourceFile: 'fixture', sourceRecord: 1,
  name: 'Gate', category: 'gate', floorId: 'B1', coordinates: [0, 0, 0], routable: true,
  access: { nodeId: 'node', distanceMeters: 0, confidence: 'high', reviewStatus: 'reviewed', accessibility: 'yes', componentId: 0, geometry: [[0, 0, 0], [0, 0, 0]] },
};

function route(distanceMeters: number, movement?: 'stairs' | 'escalator' | 'elevator'): Extract<RoutePlan, { status: 'ok' }> {
  return {
    status: 'ok', start: place, destination: { ...place, id: 'destination' }, profile: 'shortest', warnings: [],
    steps: movement ? [{ kind: 'transition', distanceMeters: 5, floorFrom: 'B1', floorTo: '0', movement, edgeIds: ['edge'] }] : [],
    network: { nodeIds: [], edgeIds: [], distanceMeters, totalCost: distanceMeters }, accessDistanceMeters: 0, totalDistanceMeters: distanceMeters, legs: [],
  };
}

describe('journey estimate', () => {
  it('uses the documented walking speed and rounds public estimates up to whole minutes', () => {
    const estimate = estimateJourney(route(72));
    expect(WALKING_SPEED_METERS_PER_SECOND).toBe(1.2);
    expect(estimate).toEqual({ durationSeconds: 60, displayMinutes: 1, floorChanges: 0 });
    expect(estimatedTimeText(estimate)).toBe('About 1 min');
  });

  it.each(['stairs', 'escalator', 'elevator'] as const)('adds the documented %s transition allowance', (movement) => {
    const estimate = estimateJourney(route(120, movement));
    expect(estimate.durationSeconds).toBe(100 + TRANSITION_ALLOWANCE_SECONDS[movement]);
    expect(estimate.floorChanges).toBe(1);
  });

  it('describes a zero-distance journey without inventing walking time', () => {
    const estimate = estimateJourney(route(0));
    expect(estimate.displayMinutes).toBe(0);
    expect(estimatedTimeText(estimate)).toBe('Already there');
  });
});
