import { resolveIndoorMapCategory, type IndoorMapCategoryLayer } from '../data/indoorMapCategories.js';
import { publicPlaceName, floorDisplayName } from '../places/placePresentation.js';
import type { NamedPlaceRecord } from '../schema/processed.js';
import type { RouteStep } from '../routing/routeInstructions.js';
import type { RouteWarning } from '../routing/routeService.js';
import type { RoutingProfile } from '../routing/pathfinding.js';
import type { JourneyEstimate } from '../routing/journeyEstimate.js';
import type { GraphEdge } from '../graph/types.js';
import { translate, type Locale } from './types.js';
import type { PlaceTranslationsDataset } from '../schema/placeTranslations.js';

export function formatDistance(distanceMeters: number): string {
  return distanceMeters < 10 ? `${distanceMeters.toFixed(1)} m` : `${Math.round(distanceMeters)} m`;
}

export function formatJourneyEstimate(estimate: JourneyEstimate, locale: Locale): string {
  if (estimate.displayMinutes === 0) return translate(locale, 'time.alreadyThere');
  return translate(locale, 'time.aboutMinutes', { minutes: estimate.displayMinutes });
}

export function formatRoutingProfile(profile: RoutingProfile, locale: Locale): string {
  const keys = {
    shortest: 'profile.shortest',
    accessible: 'profile.accessible',
    'avoid-stairs': 'profile.avoidStairs',
    'prefer-elevator': 'profile.preferElevator',
    'fewest-floor-changes': 'profile.fewestFloorChanges',
  } as const;
  return translate(locale, keys[profile]);
}

export function formatMovement(kind: GraphEdge['kind'] | undefined, locale: Locale): string {
  if (kind === 'stairs') return translate(locale, 'movement.stairs');
  if (kind === 'escalator') return translate(locale, 'movement.escalator');
  if (kind === 'elevator') return translate(locale, 'movement.elevator');
  return translate(locale, 'movement.passage');
}

export function formatIndoorMapCategory(layer: IndoorMapCategoryLayer, code: string, locale: Locale): string {
  const category = resolveIndoorMapCategory(layer, code);
  return locale === 'ja' ? category.nameJa : category.nameEn;
}

export function formatRouteInstruction(
  step: RouteStep,
  start: NamedPlaceRecord,
  destination: NamedPlaceRecord,
  locale: Locale,
  translations?: PlaceTranslationsDataset,
): string {
  const distance = formatDistance(step.distanceMeters);
  const floor = floorDisplayName(step.floorFrom, locale);
  if (step.kind === 'access') {
    return translate(locale, 'instruction.access', {
      place: publicPlaceName(start, locale, translations),
      distance,
      floor,
    });
  }
  if (step.kind === 'transition') {
    return translate(locale, 'instruction.transition', {
      movement: formatMovement(step.movement, locale),
      fromFloor: floorDisplayName(step.floorFrom, locale),
      toFloor: floorDisplayName(step.floorTo, locale),
      distance,
    });
  }
  if (step.kind === 'turn-left') return translate(locale, 'instruction.turnLeft', { floor, distance });
  if (step.kind === 'turn-right') return translate(locale, 'instruction.turnRight', { floor, distance });
  if (step.kind === 'continue') return translate(locale, 'instruction.continue', { floor, distance });
  const place = publicPlaceName(destination, locale, translations);
  if (step.alreadyThere) return translate(locale, 'instruction.alreadyThere', { place });
  if (step.distanceMeters > 0) return translate(locale, 'instruction.arriveAccess', { place, distance });
  return translate(locale, 'instruction.arrive', { place });
}

export function formatRouteWarning(
  warning: RouteWarning,
  places: NamedPlaceRecord[],
  locale: Locale,
  translations?: PlaceTranslationsDataset,
): string {
  if (warning.code === 'accessibility-fields-unknown') {
    return translate(locale, 'warning.unknownFields', { fields: warning.fields.join(', ') });
  }
  const names = warning.placeIds.map((id) => {
    const place = places.find((candidate) => candidate.id === id);
    return place ? publicPlaceName(place, locale, translations) : id;
  });
  return translate(locale, 'warning.unverifiedAccess', { places: names.join(locale === 'ja' ? '、' : ', ') });
}

export function formatFloorChanges(count: number, locale: Locale): string {
  return translate(locale, count === 1 ? 'routeSheet.floorChanges.one' : 'routeSheet.floorChanges.many', { count });
}

export function formatWarningCount(count: number, locale: Locale): string {
  if (count === 0) return translate(locale, 'routeSheet.warningCount.none');
  return translate(locale, count === 1 ? 'routeSheet.warningCount.one' : 'routeSheet.warningCount.many', { count });
}
