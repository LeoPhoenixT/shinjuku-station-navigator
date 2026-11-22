import type { NamedPlaceRecord } from '../schema/processed.js';
import type { FacilityMarkerCandidate } from './facilityMarkers.js';

export type FloorViewMode = 'focused' | 'route' | 'stack' | 'custom';

export const HIDDEN_MARKER_CATEGORY_CODES = new Set(['F011', 'F014']);
export const GATE_BADGE_COLOR = '#bba7f2';
export const GATE_BADGE_SYMBOL = 'GT';

export function facilityMarkerMatchesPreferences(marker: FacilityMarkerCandidate, enabledCategoryCodes: ReadonlySet<string>): boolean {
  return !HIDDEN_MARKER_CATEGORY_CODES.has(marker.categoryCode) && enabledCategoryCodes.has(marker.categoryCode);
}

export function placeMarkerDetail(place: NamedPlaceRecord, startId: string, destinationId: string, showGates: boolean, showGateNames: boolean): 'label' | 'icon' | undefined {
  if (place.id === startId || place.id === destinationId) return 'label';
  if (showGates && place.category === 'gate') return showGateNames ? 'label' : 'icon';
}
