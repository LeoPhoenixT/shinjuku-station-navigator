import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildPlaceTranslations } from '../scripts/build-place-translations';
import { searchPlaces } from '../src/features/route-planner/placeSearch';
import { publicAreaName, publicPlaceName } from '../src/places/placePresentation';
import { parseNamedPlaces } from '../src/schema/processed';
import { parsePlaceTranslationSource, parsePlaceTranslations, type PlaceTranslationSource } from '../src/schema/placeTranslations';

const namedPlaces = parseNamedPlaces(JSON.parse(readFileSync('public/data/processed/shinjuku-b1-named-places.json', 'utf8')));
const translations = parsePlaceTranslations(JSON.parse(readFileSync('public/data/processed/shinjuku-place-translations.json', 'utf8')), namedPlaces);
const source = JSON.parse(readFileSync('data/place-translations.source.json', 'utf8')) as PlaceTranslationSource;
const temporaryDirectories: string[] = [];

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

describe('Phase 2 place translations', () => {
  it('covers every routable place and public area with explicit fallback status', () => {
    expect(translations.places).toHaveLength(namedPlaces.places.filter(({ routable }) => routable).length);
    expect(translations.areas).toHaveLength(new Set(namedPlaces.places.filter(({ routable }) => routable).map(({ sourceFacility }) => sourceFacility)).size);
    expect(translations.places.filter(({ status }) => status === 'pending').every(({ en }) => en === undefined)).toBe(true);
    expect(translations.places.filter(({ status }) => status !== 'pending').every(({ en }) => Boolean(en))).toBe(true);
  });

  it('rejects unknown IDs, duplicate IDs, unsupported locale keys, and Japanese source mismatches', () => {
    const unknown = structuredClone(source);
    unknown.places[0].id = 'gate:unknown';
    expect(() => parsePlaceTranslationSource(unknown, namedPlaces)).toThrow('Unknown place translation ID');

    const duplicate = structuredClone(source);
    duplicate.places.push(structuredClone(duplicate.places[0]));
    expect(() => parsePlaceTranslationSource(duplicate, namedPlaces)).toThrow('Duplicate place translation');

    const unsupported = structuredClone(source) as unknown as { places: Array<Record<string, unknown>> };
    unsupported.places[0].fr = 'Porte centrale';
    expect(() => parsePlaceTranslationSource(unsupported, namedPlaces)).toThrow('unsupported keys');

    const mismatch = structuredClone(source);
    mismatch.places[0].ja = '別の名前';
    expect(() => parsePlaceTranslationSource(mismatch, namedPlaces)).toThrow('authoritative Japanese source');

    const missingEnglish = structuredClone(source);
    delete missingEnglish.places[0].en;
    expect(() => parsePlaceTranslationSource(missingEnglish, namedPlaces)).toThrow('requires English text');
  });

  it('builds byte-identical deterministic runtime and coverage artifacts', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'shinjuku-translations-'));
    temporaryDirectories.push(directory);
    const firstData = path.join(directory, 'first.json');
    const firstReport = path.join(directory, 'first-report.json');
    const secondData = path.join(directory, 'second.json');
    const secondReport = path.join(directory, 'second-report.json');
    buildPlaceTranslations(undefined, undefined, firstData, firstReport);
    buildPlaceTranslations(undefined, undefined, secondData, secondReport);
    expect(readFileSync(firstData, 'utf8')).toBe(readFileSync(secondData, 'utf8'));
    expect(readFileSync(firstReport, 'utf8')).toBe(readFileSync(secondReport, 'utf8'));
  });

  it('resolves reviewed English, authoritative Japanese, and visible Japanese fallback', () => {
    const central = namedPlaces.places.find(({ id }) => id === 'gate:59da841748574ff1bdc9408b504e3b85')!;
    const pending = translations.places.find(({ status }) => status === 'pending')!;
    const pendingPlace = namedPlaces.places.find(({ id }) => id === pending.id)!;
    expect(publicPlaceName(central, 'en', translations)).toBe('Central Gate');
    expect(publicPlaceName(central, 'ja', translations)).toBe('中央改札');
    expect(publicPlaceName(pendingPlace, 'en', translations)).toBe(pending.ja);
    expect(publicAreaName('12.西武新宿駅', 'en', translations)).toBe('Seibu-Shinjuku Station');
    const generated = translations.places.find(({ status }) => status === 'specification')!;
    const generatedPlace = namedPlaces.places.find(({ id }) => id === generated.id)!;
    expect(publicPlaceName(generatedPlace, 'en', translations)).toBe(generated.en);
  });

  it('promotes official lavatory categories while preserving technical equipment identifiers', () => {
    const expectedLavatories = new Map([
      ['B007', 'Lavatory (Male)'],
      ['B008', 'Lavatory (Female)'],
      ['B010', 'Lavatory (Unspecified)'],
      ['B011', 'Multipurpose Lavatory'],
    ]);

    for (const [sourceCategoryCode, expectedEnglish] of expectedLavatories) {
      const place = namedPlaces.places.find((candidate) =>
        candidate.routable
        && candidate.sourceLayer === 'Space'
        && candidate.sourceCategoryCode === sourceCategoryCode);
      const translation = translations.places.find(({ id }) => id === place?.id);
      expect(translation).toMatchObject({
        en: expectedEnglish,
        status: 'specification',
        source: 'MLIT source package 製品仕様書.pdf table 8.1.4',
      });
    }

    for (const sourceCategoryCode of ['B022', 'B023']) {
      const place = namedPlaces.places.find((candidate) =>
        candidate.routable
        && candidate.sourceLayer === 'Space'
        && candidate.sourceCategoryCode === sourceCategoryCode);
      const translation = translations.places.find(({ id }) => id === place?.id);
      expect(translation).toMatchObject({
        ja: place?.name,
        status: 'pending',
        source: 'authoritative-japanese-fallback',
      });
      expect(translation?.en).toBeUndefined();
    }

    const pendingPlaces = translations.places
      .filter(({ status }) => status === 'pending')
      .map(({ id }) => namedPlaces.places.find((place) => place.id === id));
    expect(pendingPlaces).toHaveLength(47);
    expect(pendingPlaces.every((place) =>
      place?.sourceLayer === 'Space'
      && ['B022', 'B023'].includes(place.sourceCategoryCode ?? ''))).toBe(true);
  });

  it('uses reviewed official gate names and searchable ASCII aliases', () => {
    const gate = translations.places.find(({ id }) => id === 'gate:ee35e1bdfcf0476fa848e9ca356b6667');
    expect(gate).toMatchObject({
      ja: '甲州街道改札',
      en: 'Kōshū-kaidō Gate',
      aliasesEn: ['Koshu-kaido Gate'],
      status: 'reviewed',
    });
    expect(searchPlaces(namedPlaces.places, 'Koshu-kaido Gate', 'ja', translations).map(({ id }) => id))
      .toContain(gate?.id);
  });

  it('publishes reviewed English for the final six user-facing fallback records', () => {
    const expected = new Map([
      ['connector:6e09f033cda0472cb754fef74c313d83:0', 'Street-level Elevator Connection Point'],
      ['facility:phase7b:7.京王新宿駅_京王モールアネックス/B1/KeioSin_B1_Facility:72dff2f161b14d72bdebd39050f6d842', 'Yasuda Exit'],
      ['gate:241abb334bc84dccb82ad5eae8254670', 'JR Shinjuku Sta. District Gate'],
      ['gate:51d62720f8bf4fd5879b70c2c9db5408', 'Odakyū South Gate'],
      ['gate:6359b61774eb4abfb111b2c4bb455df0', 'Otakibashi-dori (Ave.) District Gate'],
      ['gate:c376a65546bc45e1adbe2db7404c484d', 'Keio Line Transfer Gate'],
    ]);

    for (const [id, en] of expected) {
      expect(translations.places.find((translation) => translation.id === id)).toMatchObject({
        en,
        status: 'reviewed',
      });
    }
  });

  it('searches both languages regardless of UI locale with NFKC normalization', () => {
    const englishInJapaneseUi = searchPlaces(namedPlaces.places, 'CENTRAL GATE', 'ja', translations).map(({ id }) => id);
    const japaneseInEnglishUi = searchPlaces(namedPlaces.places, '中央改札', 'en', translations).map(({ id }) => id);
    expect(englishInJapaneseUi).toContain('gate:59da841748574ff1bdc9408b504e3b85');
    expect(japaneseInEnglishUi).toContain('gate:59da841748574ff1bdc9408b504e3b85');
    expect(searchPlaces(namedPlaces.places, 'ｻﾌﾞﾅｰﾄﾞ', 'en', translations).length).toBeGreaterThan(0);
    expect(searchPlaces(namedPlaces.places, 'Lavatory (Male)', 'ja', translations).length).toBeGreaterThan(0);
    expect(searchPlaces(namedPlaces.places, 'トイレ（男性）', 'en', translations).length).toBeGreaterThan(0);
    expect(searchPlaces(namedPlaces.places, 'Central', 'en', translations).map(({ id }) => id))
      .toEqual(searchPlaces(namedPlaces.places, 'Central', 'ja', translations).map(({ id }) => id));
  });
});
