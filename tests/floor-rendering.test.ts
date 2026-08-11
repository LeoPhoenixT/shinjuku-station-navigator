import { describe, expect, it } from 'vitest';
import {
  FLOOR_SKIRT_HEIGHT_METERS,
  FLOOR_SKIRT_OFFSET_METERS,
  FLOOR_SURFACE_HEIGHT_METERS,
  floorMeshRenderOrder,
} from '../src/map/floorRendering.js';

describe('floor rendering presentation', () => {
  it('adds a substantial downward skirt without moving the walkable surface', () => {
    expect(FLOOR_SKIRT_HEIGHT_METERS).toBeGreaterThanOrEqual(0.8);
    expect(FLOOR_SKIRT_OFFSET_METERS + FLOOR_SKIRT_HEIGHT_METERS).toBeCloseTo(FLOOR_SURFACE_HEIGHT_METERS);
  });

  it('keeps transparent context meshes deterministic and behind active meshes', () => {
    expect(floorMeshRenderOrder(true, 1, 0)).toBeGreaterThan(floorMeshRenderOrder(true, 0, 2));
    expect(floorMeshRenderOrder(false, 0, 0)).toBeGreaterThan(floorMeshRenderOrder(true, 99, 2));
  });
});
