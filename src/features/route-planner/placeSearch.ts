import type { NamedPlaceRecord } from '../../schema/processed.js';
import { areaTranslation, categoryDisplayName, placeOptionText, placeTranslation, publicAreaName, publicPlaceName } from '../../places/placePresentation.js';
import { floorElevationMeters } from '../../data/floors.js';
import type { Locale } from '../../i18n/types.js';
import type { PlaceTranslationsDataset } from '../../schema/placeTranslations.js';

export const MAP_SELECTION_TOLERANCE_METERS = 15;

export function placeDisplayName(place: NamedPlaceRecord, locale: Locale = 'en', translations?: PlaceTranslationsDataset): string {
  return placeOptionText(place, locale, translations);
}

export function normalizePlaceQuery(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ja').replaceAll(/\s+/g, ' ').trim();
}

function searchTerms(place: NamedPlaceRecord, translations?: PlaceTranslationsDataset): string[] {
  const translatedPlace = placeTranslation(place.id, translations);
  const translatedArea = areaTranslation(place.sourceFacility, translations);
  return [
    place.name,
    translatedPlace?.ja,
    translatedPlace?.en,
    ...(translatedPlace?.aliasesJa ?? []),
    ...(translatedPlace?.aliasesEn ?? []),
    categoryDisplayName(place.category, 'en'),
    categoryDisplayName(place.category, 'ja'),
    place.sourceFacility,
    translatedArea?.ja,
    translatedArea?.en,
    ...(translatedArea?.aliasesJa ?? []),
    ...(translatedArea?.aliasesEn ?? []),
    ...(place.aliases ?? []),
  ].filter((value): value is string => Boolean(value));
}

export interface PlaceSearchIndexStatistics {
  placeCount: number;
  routablePlaceCount: number;
  indexedTermCount: number;
  /** Every substring query visits this many pre-normalized documents. */
  queryCandidateCount: number;
}

export interface PlaceSearchIndex {
  readonly statistics: PlaceSearchIndexStatistics;
  readonly categories: readonly NamedPlaceRecord['category'][];
  indexOf(id: string): number | undefined;
  findById(id: string): NamedPlaceRecord | undefined;
  search(query: string, locale?: Locale): NamedPlaceRecord[];
  findByDisplayName(value: string, locale?: Locale): NamedPlaceRecord | undefined;
}

export interface PlaceIdIndex {
  indexOf(id: string): number | undefined;
}

interface IndexedPlace {
  place: NamedPlaceRecord;
  normalizedTerms: readonly string[];
}

export function buildPlaceIdIndex(places: readonly NamedPlaceRecord[]): PlaceIdIndex {
  const indexes = new Map(places.map(({ id }, index) => [id, index]));
  return Object.freeze({ indexOf: (id: string) => indexes.get(id) });
}

export function buildPlaceSearchIndex(places: readonly NamedPlaceRecord[], translations?: PlaceTranslationsDataset): PlaceSearchIndex {
  const idIndex = buildPlaceIdIndex(places);
  const entries: IndexedPlace[] = [];
  const displayNames = new Map<Locale, Map<string, NamedPlaceRecord>>([
    ['en', new Map()],
    ['ja', new Map()],
  ]);
  let indexedTermCount = 0;
  for (const place of places) {
    for (const locale of ['en', 'ja'] as const) {
      const displayName = placeDisplayName(place, locale, translations);
      const names = displayNames.get(locale)!;
      if (!names.has(displayName)) names.set(displayName, place);
    }
    if (!place.routable) continue;
    const normalizedTerms = searchTerms(place, translations).map(normalizePlaceQuery);
    indexedTermCount += normalizedTerms.length;
    entries.push({ place, normalizedTerms });
  }
  const statistics = Object.freeze({ placeCount: places.length, routablePlaceCount: entries.length, indexedTermCount, queryCandidateCount: entries.length });
  const categories = Object.freeze([...new Set(entries.map(({ place }) => place.category))]);

  return Object.freeze({
    statistics,
    categories,
    indexOf: idIndex.indexOf,
    findById(id: string): NamedPlaceRecord | undefined {
      const index = idIndex.indexOf(id);
      return index === undefined ? undefined : places[index];
    },
    search(query: string, locale: Locale = 'en'): NamedPlaceRecord[] {
      void locale; // Display locale intentionally does not change the bilingual index.
      const normalized = normalizePlaceQuery(query);
      if (!normalized) return entries.map(({ place }) => place);
      return entries.filter(({ normalizedTerms }) => normalizedTerms.some((term) => term.includes(normalized))).map(({ place }) => place);
    },
    findByDisplayName(value: string, locale: Locale = 'en'): NamedPlaceRecord | undefined {
      return displayNames.get(locale)?.get(value);
    },
  });
}

export function searchPlaces(places: NamedPlaceRecord[], query: string, locale: Locale = 'en', translations?: PlaceTranslationsDataset): NamedPlaceRecord[] {
  return buildPlaceSearchIndex(places, translations).search(query, locale);
}

export interface PlaceSearchGroup {
  floorId: string;
  areaId: string;
  area: string;
  category: NamedPlaceRecord['category'];
  places: NamedPlaceRecord[];
}

export function groupPlacesByFloorArea(places: NamedPlaceRecord[], locale: Locale = 'en', translations?: PlaceTranslationsDataset): PlaceSearchGroup[] {
  const groups = new Map<string, PlaceSearchGroup>();
  for (const place of places) {
    const key = `${place.floorId}\u0000${place.sourceFacility}\u0000${place.category}`;
    const group = groups.get(key) ?? { floorId: place.floorId, areaId: place.sourceFacility, area: publicAreaName(place.sourceFacility, locale, translations), category: place.category, places: [] };
    group.places.push(place);
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort((a, b) => floorElevationMeters(a.floorId) - floorElevationMeters(b.floorId) || a.area.localeCompare(b.area, 'ja') || categoryDisplayName(a.category, locale).localeCompare(categoryDisplayName(b.category, locale), locale))
    .map((group) => ({ ...group, places: [...group.places].sort((a, b) => publicPlaceName(a, locale, translations).localeCompare(publicPlaceName(b, locale, translations), locale) || a.id.localeCompare(b.id)) }));
}

export function findPlaceByDisplayName(places: NamedPlaceRecord[], value: string, locale: Locale = 'en', translations?: PlaceTranslationsDataset): NamedPlaceRecord | undefined {
  return buildPlaceSearchIndex(places, translations).findByDisplayName(value, locale);
}

export function findNearestRoutablePlace(
  places: NamedPlaceRecord[],
  point: [number, number],
  toleranceMeters = MAP_SELECTION_TOLERANCE_METERS,
): NamedPlaceRecord | undefined {
  return places
    .filter(({ routable }) => routable)
    .map((place) => ({ place, distance: Math.hypot(place.coordinates[0] - point[0], place.coordinates[2] - point[1]) }))
    .filter(({ distance }) => distance <= toleranceMeters)
    .sort((a, b) => a.distance - b.distance || a.place.id.localeCompare(b.place.id))[0]?.place;
}
