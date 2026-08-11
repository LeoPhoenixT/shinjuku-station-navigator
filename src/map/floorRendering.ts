export const FLOOR_SURFACE_HEIGHT_METERS = 0.28;
export const FLOOR_SKIRT_HEIGHT_METERS = 1;
export const FLOOR_SKIRT_OFFSET_METERS = FLOOR_SURFACE_HEIGHT_METERS - FLOOR_SKIRT_HEIGHT_METERS;

export function floorMeshRenderOrder(context: boolean, floorIndex: number, layerIndex: number): number {
  return (context ? 10 : 1000) + floorIndex * 4 + layerIndex;
}
