import { describe, expect, it } from 'vitest';
import { displayElevation, displayPoint, STACKED_FLOOR_GAP_METERS } from '../src/map/stackedElevation';
import { DEFAULT_ROTATION_ENABLED, DEFAULT_STACKED_FLOORS, FLOOR_ENVELOPE_HEIGHT_METERS, partitionVisibleFloors } from '../src/map/viewerPresentation';

describe('stacked floor display elevation', () => {
  it('preserves source elevation outside stacked mode', () => {
    expect(displayElevation(-5, false)).toBe(-5);
    expect(displayElevation(0, false)).toBe(0);
  });

  it('spaces stacked floors at the configured display gap', () => {
    expect(STACKED_FLOOR_GAP_METERS).toBe(30);
    expect(displayElevation(-5, true)).toBe(-STACKED_FLOOR_GAP_METERS);
    expect(displayElevation(0, true)).toBe(0);
    expect(displayElevation(5, true)).toBe(STACKED_FLOOR_GAP_METERS);
    expect(displayPoint([2, -5, 3], true)).toEqual([2, -STACKED_FLOOR_GAP_METERS, 3]);
  });

  it('keeps every floor detailed in the default stack', () => {
    expect(partitionVisibleFloors(['B1', 'G', '1'], 'G', [], 'stack')).toEqual({
      activeFloors: ['B1', 'G', '1'],
      contextFloors: [],
    });
  });

  it('uses outlines only for non-route or unfocused floors', () => {
    expect(partitionVisibleFloors(['B1', 'G', '1'], 'G', ['B1', 'G'], 'route')).toEqual({
      activeFloors: ['B1', 'G'],
      contextFloors: ['1'],
    });
    expect(partitionVisibleFloors(['B1', 'G', '1'], 'G', [], 'focused')).toEqual({
      activeFloors: ['G'],
      contextFloors: ['B1', '1'],
    });
  });

  it('starts in a rotatable stack with non-overlapping floor envelopes', () => {
    expect(DEFAULT_STACKED_FLOORS).toBe(true);
    expect(DEFAULT_ROTATION_ENABLED).toBe(true);
    expect(FLOOR_ENVELOPE_HEIGHT_METERS).toBeGreaterThan(0);
    expect(FLOOR_ENVELOPE_HEIGHT_METERS).toBeLessThan(STACKED_FLOOR_GAP_METERS);
  });
});
