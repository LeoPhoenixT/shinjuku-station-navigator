import { describe, expect, it } from 'vitest';
import {
  calculateTwoFingerDelta,
  cameraAzimuthAfterTwist,
  createTwoFingerSnapshot,
  MAX_CAMERA_POLAR_ANGLE,
  normalizeAngleDelta,
  shouldActivateTwist,
  TWIST_ACTIVATION_RADIANS,
} from '../src/map/touchGestures.js';

function snapshot(first: [number, number], second: [number, number]) {
  return createTwoFingerSnapshot([
    { id: 1, x: first[0], y: first[1] },
    { id: 2, x: second[0], y: second[1] },
  ])!;
}

describe('mobile map gestures', () => {
  it('recognizes a two-finger twist independently from pinch and tilt', () => {
    const delta = calculateTwoFingerDelta(snapshot([-10, 0], [10, 0]), snapshot([0, -10], [0, 10]));
    expect(delta.twistRadians).toBeCloseTo(Math.PI / 2);
    expect(delta.zoomRatio).toBeCloseTo(1);
    expect(delta.tiltPixels).toBe(0);
  });

  it('maps a finger twist to the same camera rotation direction', () => {
    expect(cameraAzimuthAfterTwist(0.4, 0.2)).toBeCloseTo(0.6);
    expect(cameraAzimuthAfterTwist(0.4, -0.2)).toBeCloseTo(0.2);
  });

  it('ignores small two-finger angle jitter until an intentional twist is established', () => {
    expect(shouldActivateTwist(TWIST_ACTIVATION_RADIANS * 0.99)).toBe(false);
    expect(shouldActivateTwist(-TWIST_ACTIVATION_RADIANS * 0.99)).toBe(false);
    expect(shouldActivateTwist(TWIST_ACTIVATION_RADIANS)).toBe(true);
    expect(shouldActivateTwist(-TWIST_ACTIVATION_RADIANS)).toBe(true);
  });

  it('recognizes a pinch without treating opposite finger movement as tilt', () => {
    const delta = calculateTwoFingerDelta(snapshot([-10, 0], [10, 0]), snapshot([-20, 0], [20, 0]));
    expect(delta.zoomRatio).toBeCloseTo(2);
    expect(delta.twistRadians).toBeCloseTo(0);
    expect(delta.tiltPixels).toBe(0);
  });

  it('recognizes parallel vertical movement as camera tilt', () => {
    const delta = calculateTwoFingerDelta(snapshot([-10, 10], [10, 10]), snapshot([-10, -5], [10, -5]));
    expect(delta.tiltPixels).toBe(-15);
    expect(delta.zoomRatio).toBeCloseTo(1);
    expect(delta.twistRadians).toBeCloseTo(0);
  });

  it('uses stable pointer ordering regardless of event insertion order', () => {
    const result = createTwoFingerSnapshot([
      { id: 9, x: 10, y: 0 },
      { id: 3, x: -10, y: 0 },
    ]);
    expect(result?.first.id).toBe(3);
    expect(result?.second.id).toBe(9);
  });

  it('normalizes rotation across the angle wrap boundary', () => {
    expect(normalizeAngleDelta(-358 * Math.PI / 180)).toBeCloseTo(2 * Math.PI / 180);
  });

  it('keeps the maximum camera angle above the map plane', () => {
    expect(MAX_CAMERA_POLAR_ANGLE).toBeLessThan(Math.PI / 2);
  });
});
