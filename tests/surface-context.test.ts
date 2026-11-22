import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clipLinePath } from '../scripts/data/clip-line-path.js';
import { parseSurfaceContext, SURFACE_CONTEXT_FILE } from '../src/schema/surfaceContext.js';

const surface = parseSurfaceContext(JSON.parse(readFileSync(`public/data/processed/${SURFACE_CONTEXT_FILE}`, 'utf8')));

describe('surface context', () => {
  it('covers both sides of the station and the bus terminal south of Koshu Kaido Gate', () => {
    const { landmarks } = surface;
    expect(landmarks.map(({ id }) => id)).toEqual(['east-exit', 'west-exit', 'busta']);
    expect(landmarks[0].position[0]).toBeGreaterThan(0);
    expect(landmarks[1].position[0]).toBeLessThan(0);
    expect(landmarks[2].position[1]).toBeGreaterThan(233.046);
  });

  it('rejects invalid geometry and duplicate landmarks', () => {
    expect(() => parseSurfaceContext({ ...surface, roadEdges: [[[0, 0], [0, 0]]] })).toThrow(/road edge/);
    expect(() => parseSurfaceContext({ ...surface, roadMedians: [[[0, 0], [Infinity, 0]]] })).toThrow(/road median/);
    expect(() => parseSurfaceContext({ ...surface, landmarks: Array(3).fill(surface.landmarks[0]) })).toThrow(/landmark/);
  });

  it('clips buffered tile geometry without connecting separate crossings', () => {
    const bounds = { left: 0, right: 10, top: 0, bottom: 10 };
    expect(clipLinePath([[-2, 2], [2, 2], [12, 2], [12, 8], [2, 8]], bounds, (point) => point))
      .toEqual([[[0, 2], [2, 2], [10, 2]], [[10, 8], [2, 8]]]);
  });
});
