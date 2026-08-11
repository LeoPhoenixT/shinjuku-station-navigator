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

export function searchPlaces(places: NamedPlaceRecord[], query: string, locale: Locale = 'en', translations?: PlaceTranslationsDataset): NamedPlaceRecord[] {
  void locale; // Display locale intentionally does not change the bilingual index.
  const normalized = normalizePlaceQuery(query);
  const routable = places.filter(({ routable }) => routable);
  if (!normalized) return routable;
  return routable.filter((place) => {
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
    ].filter((value): value is string => Boolean(value))
      .some((value) => normalizePlaceQuery(value).includes(normalized));
  });
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
  return places.find((place) => placeDisplayName(place, locale, translations) === value);
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
