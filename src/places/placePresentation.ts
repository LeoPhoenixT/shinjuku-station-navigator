import type { NamedPlaceRecord } from '../schema/processed.js';
import type { PlaceTranslationRecord, PlaceTranslationsDataset } from '../schema/placeTranslations.js';
import { translate, type Locale } from '../i18n/types.js';

const TECHNICAL_NAME = /^(?:[A-Z]{2,}[A-Z0-9]*[_-]|[A-Z]+_[A-Z0-9_-]+$)/;

export function floorDisplayName(floorId: string, locale: Locale = 'en'): string {
  if (floorId === '0') return translate(locale, 'floor.ground');
  if (locale === 'ja') {
    const basement = /^B(\d+)$/.exec(floorId);
    if (basement) return `地下${basement[1]}階`;
    if (/^\d+$/.test(floorId)) return translate(locale, 'floor.named', { floor: floorId });
  }
  return floorId;
}

export function floorLongName(floorId: string, locale: Locale = 'en'): string {
  if (floorId === '0') return translate(locale, 'floor.groundFull');
  if (locale === 'ja') return floorDisplayName(floorId, locale);
  return translate(locale, 'floor.named', { floor: floorId });
}

export function categoryDisplayName(category: NamedPlaceRecord['category'], locale: Locale = 'en'): string {
  const keys = {
    gate: 'category.gate',
    connector: 'category.connector',
    toilet: 'category.toilet',
    elevator: 'category.elevator',
    escalator: 'category.escalator',
    stairs: 'category.stairs',
    slope: 'category.slope',
    entrance: 'category.entrance',
    exit: 'category.exit',
    information: 'category.information',
    'waiting-room': 'category.waitingRoom',
    'nursing-room': 'category.nursingRoom',
    atm: 'category.atm',
    locker: 'category.locker',
    'ticket-office': 'category.ticketOffice',
  } as const;
  return translate(locale, keys[category]);
}

export function placeTranslation(placeId: string, translations?: PlaceTranslationsDataset): PlaceTranslationRecord | undefined {
  return translations?.places.find(({ id }) => id === placeId);
}

export function areaTranslation(areaId: string, translations?: PlaceTranslationsDataset): PlaceTranslationRecord | undefined {
  return translations?.areas.find(({ id }) => id === areaId);
}

export function publicAreaName(areaId: string, locale: Locale = 'en', translations?: PlaceTranslationsDataset): string {
  const translation = areaTranslation(areaId, translations);
  if (!translation) return areaId;
  return locale === 'en' ? translation.en ?? translation.ja : translation.ja;
}

export function publicPlaceName(place: NamedPlaceRecord, locale: Locale = 'en', translations?: PlaceTranslationsDataset): string {
  const translation = placeTranslation(place.id, translations);
  if (translation) return locale === 'en' ? translation.en ?? translation.ja : translation.ja;
  if (place.nameKind === 'generated-descriptive' || TECHNICAL_NAME.test(place.name)) {
    return `${categoryDisplayName(place.category, locale)} · ${floorDisplayName(place.floorId, locale)}`;
  }
  return place.name;
}

export function placeSecondaryText(place: NamedPlaceRecord, locale: Locale = 'en', translations?: PlaceTranslationsDataset): string {
  return translate(locale, 'place.access', {
    area: publicAreaName(place.sourceFacility, locale, translations),
    distance: place.access.distanceMeters.toFixed(1),
  });
}

export function placeOptionText(place: NamedPlaceRecord, locale: Locale = 'en', translations?: PlaceTranslationsDataset): string {
  return `${publicPlaceName(place, locale, translations)} · ${placeSecondaryText(place, locale, translations)}`;
}
