import { describe, expect, it } from 'vitest';
import type { GraphEdge } from '../src/graph/types';
import { networkDirectionArrows } from '../src/map/networkDirectionGeometry';
import { displayElevation } from '../src/map/stackedElevation';

function edge(overrides: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id: 'edge', from: 'a', to: 'b', distanceMeters: 10, direction: 'forward', kind: 'escalator', accessibility: 'no',
    floorFrom: 'B1', floorTo: 'B1', geometry: [[0, -5, 0], [4, -5, 0], [10, -5, 0]], ...overrides,
  };
}

describe('network direction arrows', () => {
  it('places a forward arrow at the arclength midpoint', () => {
    expect(networkDirectionArrows([edge()], ['B1'], false)).toEqual([{ edgeId: 'edge', position: [5, -5, 0], direction: [1, 0, 0] }]);
  });

  it('reverses arrow direction for reverse-only links', () => {
    expect(networkDirectionArrows([edge({ direction: 'reverse' })], ['B1'], false)[0]).toMatchObject({ position: [5, -5, 0], direction: [-1, 0, 0] });
  });

  it('excludes bidirectional and hidden-floor links', () => {
    expect(networkDirectionArrows([edge({ direction: 'both' }), edge({ id: 'hidden', floorFrom: 'B2', floorTo: 'B1' })], ['B1'], false)).toEqual([]);
  });

  it('uses expanded elevations in a stacked view', () => {
    const arrows = networkDirectionArrows([edge({ floorFrom: 'B1', floorTo: '0', geometry: [[0, -5, 0], [0, 0, 0]] })], ['B1', '0'], true);
    expect(arrows[0].position).toEqual([0, (displayElevation(-5, true) + displayElevation(0, true)) / 2, 0]);
    expect(arrows[0].direction).toEqual([0, 1, 0]);
  });
});
