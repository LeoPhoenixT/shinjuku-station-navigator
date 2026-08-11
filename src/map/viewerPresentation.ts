import type { FloorViewMode } from './displayPreferences.js';

export const DEFAULT_STACKED_FLOORS = true;
export const DEFAULT_ROTATION_ENABLED = true;

// Display-only envelope used to communicate storey height. Routing retains
// source elevations and never uses this value for distance or cost.
export const FLOOR_ENVELOPE_HEIGHT_METERS = 4;

export function partitionVisibleFloors(
  visibleFloors: string[],
  activeFloor: string,
  routeFloorIds: string[],
  floorViewMode: FloorViewMode,
): { activeFloors: string[]; contextFloors: string[] } {
  const emphasizedFloors = routeFloorIds.length > 0
    ? visibleFloors.filter((floorId) => routeFloorIds.includes(floorId))
    : floorViewMode === 'focused'
      ? visibleFloors.filter((floorId) => floorId === activeFloor)
      : visibleFloors;
  const emphasized = new Set(emphasizedFloors);
  return {
    activeFloors: emphasizedFloors,
    contextFloors: visibleFloors.filter((floorId) => !emphasized.has(floorId)),
  };
}
