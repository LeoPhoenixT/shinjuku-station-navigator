import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { wallEnvelopeSegments } from '../src/map/wallEnvelope';
import type { ProcessedFeature } from '../src/types/processed';

function polygon(id: string, floorId: string, layer: ProcessedFeature['layer']): ProcessedFeature {
  return {
    id,
    sourceId: id,
    sourceRecord: 1,
    layer,
    floorId,
    geometry: { type: 'Polygon', parts: [[[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2], [0, 0, 0]]] },
    properties: {},
  };
}

describe('wall envelopes', () => {
  it('builds vertical outlines from both floor and space polygons', () => {
    const segments = wallEnvelopeSegments([polygon('floor', 'B1', 'Floor'), polygon('space', 'B1', 'Space')], ['B1'], false);
    expect(segments).toHaveLength(16);
    expect(segments.filter(([start, end]) => start[0] === end[0] && start[2] === end[2])).toHaveLength(8);
  });

  it('falls back to fixture polygons when a floor has no structural polygons', () => {
    expect(wallEnvelopeSegments([polygon('fixture', 'B2', 'Fixture')], ['B2'], true)).toHaveLength(8);
  });

  it('provides a wall outline for every floor in the generated full map', () => {
    const dataset = JSON.parse(readFileSync(resolve('public/data/processed/shinjuku-full-map.json'), 'utf8')) as { features: ProcessedFeature[] };
    const floorIds = [...new Set(dataset.features.map(({ floorId }) => floorId).filter((floorId): floorId is string => Boolean(floorId)))];
    for (const floorId of floorIds) expect(wallEnvelopeSegments(dataset.features, [floorId], true).length, floorId).toBeGreaterThan(0);
  });
});
