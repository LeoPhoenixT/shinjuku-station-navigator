import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { NamedPlacesDataset } from '../scripts/build-named-places.js';
import { polygonInteriorPoint } from '../scripts/build-named-places.js';

const places = JSON.parse(readFileSync('public/data/processed/shinjuku-b1-named-places.json', 'utf8')) as NamedPlacesDataset;

describe('Phase 7C named places', () => {
  it('normalizes useful multi-floor source places with same-floor official-node attachments', () => {
    const gates = places.places.filter(({ category }) => category === 'gate');
    expect(gates).toHaveLength(41);
    expect(gates.every((place) => place.id.startsWith('gate:') && place.access.nodeId.length > 0)).toBe(true);
    expect(places.places.filter(({ category }) => category === 'toilet').length).toBeGreaterThan(0);
    expect(places.places.filter(({ category }) => category === 'escalator').length).toBeGreaterThan(0);
    expect(places.places.filter(({ category }) => category === 'elevator').length).toBeGreaterThan(0);
    expect(places.places.every((place) => place.coordinates[1] === place.access.geometry[1][1])).toBe(true);
    expect(places.places.find(({ category }) => category === 'connector')).toMatchObject({ floorId: '0', nameKind: 'generated-descriptive', routable: true });
    expect(places.places.some(({ name }) => name === '不明')).toBe(false);
  });

  it('promotes only accepted Facility markers with preserved provenance and explicit access legs', () => {
    const facilities = places.places.filter(({ sourceLayer }) => sourceLayer === 'Facility');
    expect(facilities).toHaveLength(464);
    expect(facilities.every((place) => place.id.startsWith('facility:phase7b:') && place.sourceCategoryCode?.startsWith('F'))).toBe(true);
    expect(facilities.every((place) => place.routable && place.access.confidence !== 'low' && place.access.geometry[0].every((value, index) => value === place.coordinates[index]))).toBe(true);
    expect(facilities.some((place) => place.nameKind === 'generated-category' && place.name.startsWith('コインロッカー'))).toBe(true);
    expect(facilities.find(({ sourceCategoryCode }) => sourceCategoryCode === 'F108')).toMatchObject({ name: '安田口', aliases: ['出口', 'Exit'] });
  });

  it('preserves all pre-expansion place IDs for shared route URLs', () => {
    const legacyIds = new Set(places.places.filter(({ sourceLayer }) => sourceLayer !== 'Facility').map(({ id }) => id));
    expect(legacyIds.size).toBe(120);
    expect(legacyIds.has('gate:b9bd2f7edf4e444994e061cdd552af2a')).toBe(true);
    expect(legacyIds.has('gate:a628691805db44e2b65d427271a8bc24')).toBe(true);
  });

  it('records attachment confidence instead of hiding large source-to-network gaps', () => {
    expect(Object.values(places.statistics.attachmentConfidenceCounts).reduce((sum, count) => sum + count, 0)).toBe(places.statistics.placeCount);
    expect(places.statistics.attachmentConfidenceCounts.high).toBeGreaterThan(0);
    expect(places.places.find(({ name }) => name === '京王西口')?.access.confidence).toBe('high');
    expect(places.places.filter(({ routable }) => !routable).every(({ access }) => access.confidence === 'low')).toBe(true);
    expect(places.places.every(({ access }) => access.reviewStatus === 'reviewed' || access.accessibility === 'unknown')).toBe(true);
  });

  it('places polygon labels inside concave geometry instead of using an exterior centroid', () => {
    const concave = [[[0, 0], [8, 0], [8, 2], [2, 2], [2, 8], [0, 8], [0, 0]]] as Array<Array<[number, number]>>;
    const [x, y] = polygonInteriorPoint(concave);
    expect(x <= 2 || y <= 2).toBe(true);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
  });
});
