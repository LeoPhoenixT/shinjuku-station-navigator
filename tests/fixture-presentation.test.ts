import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIXTURE_PRESENTATION_STYLES, fixturePresentationStyle, groupFixtureFeatures } from '../src/map/fixturePresentation';
import type { ProcessedDataset, ProcessedFeature } from '../src/types/processed';

function feature(category: string): ProcessedFeature {
  return { id: category, sourceId: category, sourceRecord: 1, layer: 'Fixture', floorId: 'B1', geometry: { type: 'Polygon', parts: [] }, properties: { category } };
}

describe('semantic Fixture presentation', () => {
  it('uses explicit physical dimensions for structures and transport barriers', () => {
    expect(fixturePresentationStyle('C001')).toMatchObject({ group: 'column', height: 3.2, priority: 'structure' });
    expect(fixturePresentationStyle('C010')).toMatchObject({ group: 'wall', height: 3.4, priority: 'structure' });
    expect(fixturePresentationStyle('C101')).toMatchObject({ group: 'platform-gate', height: 1.45, priority: 'barrier' });
    expect(fixturePresentationStyle('C104')).toMatchObject({ group: 'ticket-gate', height: 1.05, priority: 'barrier' });
  });

  it('keeps furniture lower priority with category-appropriate heights', () => {
    expect(fixturePresentationStyle('C002')).toMatchObject({ group: 'bench', height: 0.55, priority: 'context' });
    expect(fixturePresentationStyle('C012')).toMatchObject({ group: 'locker', height: 1.8, priority: 'context' });
    expect(fixturePresentationStyle('C013')).toMatchObject({ group: 'vending-machine', height: 1.9, priority: 'context' });
    expect(fixturePresentationStyle('C014')).toMatchObject({ group: 'atm', height: 1.4, priority: 'context' });
  });

  it('preserves a subdued generic fallback and stable shared batches', () => {
    expect(FIXTURE_PRESENTATION_STYLES.map(({ group }) => group)).toContain('unknown');
    expect(fixturePresentationStyle('C777')).toMatchObject({ group: 'unknown', opacity: 0.76 });
    const grouped = groupFixtureFeatures([feature('C001'), feature('C010'), feature('C001')]);
    expect([...grouped].map(([presentation, features]) => [presentation.group, features.map(({ id }) => id)])).toEqual([
      ['column', ['C001', 'C001']],
      ['wall', ['C010']],
    ]);
  });

  it('covers every Fixture in the generated map with structural source counts intact', () => {
    const map = JSON.parse(readFileSync('public/data/processed/shinjuku-full-map.json', 'utf8')) as ProcessedDataset;
    const fixtures = map.features.filter(({ layer }) => layer === 'Fixture');
    const groups = groupFixtureFeatures(fixtures);
    expect(fixtures).toHaveLength(608);
    expect(groups.get(fixturePresentationStyle('C001'))).toHaveLength(605);
    expect(groups.get(fixturePresentationStyle('C010'))).toHaveLength(3);
    expect([...groups.values()].flat()).toHaveLength(fixtures.length);
  });
});
