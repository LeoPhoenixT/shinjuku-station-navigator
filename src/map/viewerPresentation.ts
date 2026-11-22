import type { FloorViewMode } from './displayPreferences.js';

export const DEFAULT_STACKED_FLOORS = true;
export const DEFAULT_ROTATION_ENABLED = true;
export const SURFACE_ROAD_COLOR = '#62758a';
export const SURFACE_LANDMARK_COLOR = '#f4d39d';

const floorPalette: Readonly<Record<string, { outline: string; slab: string }>> = {
  '4': { outline: '#61aec8', slab: '#224457' },
  '3': { outline: '#5cbea8', slab: '#204c47' },
  '2': { outline: '#8bdae0', slab: '#295761' },
  '1': { outline: '#74a8dc', slab: '#274963' },
  '0': { outline: '#d8e7f5', slab: '#3a4b60' },
  B1: { outline: '#bb9ff2', slab: '#4c396b' },
  B2: { outline: '#8d9aff', slab: '#343d71' },
  B3: { outline: '#a77db9', slab: '#40304f' },
};

export function floorPaletteFor(floorId: string) {
  return floorPalette[floorId] ?? floorPalette['0'];
}

export function floorMapCode(floorId: string): string {
  if (floorId === '0') return 'G';
  return /^\d+$/.test(floorId) ? `${floorId}F` : floorId;
}

// Display-only envelope used to communicate storey height. Routing retains
// source elevations and never uses this value for distance or cost.
export const FLOOR_ENVELOPE_HEIGHT_METERS = 4;

export function partitionVisibleFloors(
  visibleFloors: string[],
  activeFloor: string,
  routeFloorIds: string[],
  floorViewMode: FloorViewMode,
): { activeFloors: string[]; contextFloors: string[] } {
  const emphasizedFloors = floorViewMode === 'focused'
    ? visibleFloors.filter((floorId) => floorId === activeFloor)
    : floorViewMode === 'route'
      ? visibleFloors.filter((floorId) => routeFloorIds.includes(floorId))
      : visibleFloors;
  const emphasized = new Set(emphasizedFloors);
  return {
    activeFloors: emphasizedFloors,
    contextFloors: visibleFloors.filter((floorId) => !emphasized.has(floorId)),
  };
}
