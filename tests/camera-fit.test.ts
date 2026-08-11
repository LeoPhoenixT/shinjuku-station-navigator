import { describe, expect, it } from 'vitest';
import {
  ANGLED_CAMERA_POLAR_ANGLE,
  calculateAngledContentHeight,
  calculateCameraClearanceDistance,
  calculateOrthographicFitZoom,
} from '../src/map/cameraFit';
import { displayElevation } from '../src/map/stackedElevation';

describe('orthographic camera fitting', () => {
  it('fits both map dimensions with padding', () => {
    const zoom = calculateOrthographicFitZoom(831.2, 622.4, 201.367, 169.77);

    expect(zoom).toBeCloseTo(3.273, 3);
    expect(201.367 * zoom).toBeLessThan(831.2);
    expect(169.77 * zoom).toBeLessThan(622.4);
  });

  it('uses a safe fallback for invalid dimensions', () => {
    expect(calculateOrthographicFitZoom(0, 600, 200, 160)).toBe(1);
  });

  it('keeps the camera outside the complete Shinjuku dataset from any in-bounds target', () => {
    const width = 283.928 - (-368.414);
    const height = displayElevation(20, true) - displayElevation(-15, true);
    const depth = 390.087 - (-490.308);
    const diagonal = Math.hypot(width, height, depth);

    expect(calculateCameraClearanceDistance(width, height, depth)).toBeGreaterThan(diagonal);
  });

  it('includes stacked height in the angled screen-space fit', () => {
    const stackedHeight = displayElevation(20, true) - displayElevation(-15, true);
    const projectedHeight = calculateAngledContentHeight(stackedHeight, 880.395, ANGLED_CAMERA_POLAR_ANGLE);

    expect(ANGLED_CAMERA_POLAR_ANGLE * 180 / Math.PI).toBeCloseTo(55);
    expect(projectedHeight).toBeCloseTo(
      880.395 * Math.cos(ANGLED_CAMERA_POLAR_ANGLE)
        + stackedHeight * Math.sin(ANGLED_CAMERA_POLAR_ANGLE),
    );
  });

  it('falls back safely for invalid camera bounds', () => {
    expect(calculateCameraClearanceDistance(0, 20, 40)).toBe(220);
    expect(calculateAngledContentHeight(-1, 40, Math.PI / 4)).toBe(40);
  });
});
