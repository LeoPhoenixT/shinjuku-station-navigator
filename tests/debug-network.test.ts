import { describe, expect, it } from 'vitest';
import { allSourceLinkSegments } from '../src/map/debugNetwork';
import { displayElevation } from '../src/map/stackedElevation';
import type { OfficialNetworkDataset } from '../src/types/officialNetwork';

const dataset = {
  edges: [
    { id: 'visible', floorFrom: 'B1', floorTo: '0', validatedForRouting: true, geometry: [[0, -5, 0], [2, 0, 2]] },
    { id: 'routable', floorFrom: 'B1', floorTo: '0', validatedForRouting: true, geometry: [[0, -5, 0], [2, 0, 2]] },
    { id: 'hidden-floor', floorFrom: 'B2', floorTo: 'B1', validatedForRouting: false, geometry: [[0, -10, 0], [2, -5, 2]] },
  ],
} as unknown as OfficialNetworkDataset;

describe('all-source network debug overlay', () => {
  it('includes every source link when requested for visual inspection', () => {
    expect(allSourceLinkSegments(dataset, ['B1', '0'], false)).toHaveLength(2);
  });

  it('uses the stacked display elevation without changing the source geometry', () => {
    const b1Y = displayElevation(-5, true);
    expect(allSourceLinkSegments(dataset, ['B1', '0'], true)).toEqual([[[0, b1Y, 0], [2, 0, 2]], [[0, b1Y, 0], [2, 0, 2]]]);
  });
});
