import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { NamedPlacesDataset } from '../src/schema/processed';
import type { ProcessedDataset } from '../src/types/processed';

describe('Phase 7B full visual map', () => {
  it('contains the matching source Opening for every offered place label', () => {
    const places = JSON.parse(readFileSync('public/data/processed/shinjuku-b1-named-places.json', 'utf8')) as NamedPlacesDataset;
    const map = JSON.parse(readFileSync('public/data/processed/shinjuku-full-map.json', 'utf8')) as ProcessedDataset;
    const openings = new Set(map.features
      .filter(({ layer }) => layer === 'Opening')
      .map((feature) => `${String(feature.properties.sourceFacility)}:${feature.sourceId}`));

    for (const place of places.places.filter(({ category }) => category === 'gate')) {
      expect(openings, `${place.name} should have visible source geometry`).toContain(`${place.sourceFacility}:${place.sourceId}`);
    }
  });

  it('imports every visible source layer across B3 through 4F', () => {
    const map = JSON.parse(readFileSync('public/data/processed/shinjuku-full-map.json', 'utf8')) as ProcessedDataset;
    expect(map.features).toHaveLength(4387);
    expect(map.layers).toMatchObject({
      Floor: { featureCount: 200 }, Space: { featureCount: 1153 }, Facility: { featureCount: 639 }, Fixture: { featureCount: 608 }, Opening: { featureCount: 63 },
      Drawing: { featureCount: 996 }, TWSI_Line: { featureCount: 357 }, TWSI_Point: { featureCount: 371 },
    });
    expect(map.statistics.bounds).toEqual({ minX: -368.414, minY: -15, minZ: -490.308, maxX: 283.928, maxY: 20, maxZ: 390.087 });
    expect(new Set(map.features.map(({ floorId }) => floorId))).toEqual(new Set(['B3', 'B2', 'B1', '0', '1', '2', '3', '4']));
  });

  it('imports every Facility point while promoting only the reviewed public subset', () => {
    const map = JSON.parse(readFileSync('public/data/processed/shinjuku-full-map.json', 'utf8')) as ProcessedDataset;
    const places = JSON.parse(readFileSync('public/data/processed/shinjuku-b1-named-places.json', 'utf8')) as NamedPlacesDataset;
    const facilities = map.features.filter(({ layer }) => layer === 'Facility');
    expect(facilities).toHaveLength(639);
    expect(facilities.every(({ geometry, properties, floorId }) => geometry.type === 'Point' && typeof properties.category === 'string' && typeof properties.sourceFacility === 'string' && typeof properties.sourceFloor === 'string' && typeof floorId === 'string')).toBe(true);
    expect(places.places.filter(({ sourceLayer }) => sourceLayer === 'Facility')).toHaveLength(464);
    expect(places.places.filter(({ sourceLayer }) => sourceLayer !== 'Facility')).toHaveLength(120);
  });
});
