import type { NamedPlaceRecord } from '../schema/processed.js';
import type { FacilityMarkerCandidate } from './facilityMarkers.js';

export type FloorViewMode = 'focused' | 'route' | 'stack' | 'custom';

export const HIDDEN_MARKER_CATEGORY_CODES = new Set(['F011', 'F014']);

export function facilityMarkerMatchesPreferences(marker: FacilityMarkerCandidate, enabledCategoryCodes: ReadonlySet<string>): boolean {
  return !HIDDEN_MARKER_CATEGORY_CODES.has(marker.categoryCode) && enabledCategoryCodes.has(marker.categoryCode);
}

export function placeHasPermanentLabel(place: NamedPlaceRecord, startId: string, destinationId: string, showGates = true): boolean {
  return (showGates && place.category === 'gate') || place.id === startId || place.id === destinationId;
}
