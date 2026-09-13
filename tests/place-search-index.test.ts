import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPlaceIdIndex, buildPlaceSearchIndex, placeDisplayName } from '../src/features/route-planner/placeSearch';
import type { NamedPlaceRecord, NamedPlacesDataset } from '../src/schema/processed';
import type { PlaceTranslationsDataset } from '../src/schema/placeTranslations';

const places = JSON.parse(readFileSync('public/data/processed/shinjuku-b1-named-places.json', 'utf8')) as NamedPlacesDataset;
const translations = JSON.parse(readFileSync('public/data/processed/shinjuku-place-translations.json', 'utf8')) as PlaceTranslationsDataset;

const searchFixture: NamedPlaceRecord[] = [
  { ...places.places[0]!, id: 'fixture:gate', name: '中央入口', aliases: ['source alias'], sourceFacility: 'fixture-area', category: 'gate', routable: true },
  { ...places.places[1]!, id: 'fixture:toilet', name: '衛生設備', sourceFacility: 'fixture-area', category: 'toilet', routable: true },
  { ...places.places[2]!, id: 'fixture:low', name: '非公開入口', sourceFacility: 'fixture-area', category: 'gate', routable: false },
];
const fixtureTranslations = {
  places: [{ id: 'fixture:gate', ja: '中央ゲート', en: 'Central Gate', aliasesJa: ['中央別名'], aliasesEn: ['central alias'], status: 'reviewed', source: 'fixture' }],
  areas: [{ id: 'fixture-area', ja: '西エリア', en: 'West Area', aliasesJa: ['西側'], aliasesEn: ['west alias'], status: 'reviewed', source: 'fixture' }],
} as PlaceTranslationsDataset;

describe('place search index', () => {
  it('indexes the committed 584-place dataset and preserves empty-query order', () => {
    const index = buildPlaceSearchIndex(places.places, translations);
    expect(index.statistics).toMatchObject({ placeCount: 584, routablePlaceCount: 583, queryCandidateCount: 583 });
    expect(index.statistics.indexedTermCount).toBe(6053);
    expect(index.indexOf(places.places[0]!.id)).toBe(0);
    expect(index).not.toHaveProperty('idToIndex');
    expect(Object.isFrozen(index.categories)).toBe(true);
    expect(index.findByDisplayName(placeDisplayName(places.places[0]!, 'en', translations), 'en')).toBe(places.places[0]);
    expect(index.search('').map(({ id }) => id)).toEqual(places.places.filter(({ routable }) => routable).map(({ id }) => id));
  });

  it('matches known Japanese, English, alias, area, category, and locale-invariant fixture results', () => {
    const index = buildPlaceSearchIndex(searchFixture, fixtureTranslations);
    expect(index.search('').map(({ id }) => id)).toEqual(['fixture:gate', 'fixture:toilet']);
    expect(index.search('中央').map(({ id }) => id)).toEqual(['fixture:gate']);
    expect(index.search('central gate').map(({ id }) => id)).toEqual(['fixture:gate']);
    expect(index.search('CENTRAL ALIAS').map(({ id }) => id)).toEqual(['fixture:gate']);
    expect(index.search('west alias').map(({ id }) => id)).toEqual(['fixture:gate', 'fixture:toilet']);
    expect(index.search('Toilet').map(({ id }) => id)).toEqual(['fixture:toilet']);
    expect(index.search('central gate', 'en').map(({ id }) => id)).toEqual(index.search('central gate', 'ja').map(({ id }) => id));
  });

  it('rebuilds from new input identities and provides stable id-to-index maps', () => {
    const index = buildPlaceSearchIndex(places.places, translations);
    const added: NamedPlaceRecord = { ...places.places[0]!, id: 'fixture:reindexed', name: 'Reindexed place', aliases: ['new index only'] };
    const rebuilt = buildPlaceSearchIndex([...places.places, added], translations);
    expect(index.search('new index only')).toEqual([]);
    expect(rebuilt.search('new index only').map(({ id }) => id)).toEqual(['fixture:reindexed']);
    expect(buildPlaceIdIndex(rebuilt.search('new index only')).indexOf('fixture:reindexed')).toBe(0);

    const translated = translations.places.find(({ id }) => places.places.some((place) => place.id === id))!;
    const translationsRebuilt = {
      ...translations,
      places: translations.places.map((entry) => entry.id === translated.id ? { ...entry, aliasesEn: [...entry.aliasesEn, 'translation identity only'] } : entry),
    };
    const translationIndex = buildPlaceSearchIndex(places.places, translationsRebuilt);
    expect(index.search('translation identity only')).toEqual([]);
    expect(translationIndex.search('translation identity only').map(({ id }) => id)).toEqual([translated.id]);
  });
});
