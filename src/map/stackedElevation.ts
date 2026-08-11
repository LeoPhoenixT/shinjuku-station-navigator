export const STACKED_FLOOR_GAP_METERS = 30;

export function displayElevation(y: number, stacked: boolean): number {
  if (!stacked) return y;
  return y * (STACKED_FLOOR_GAP_METERS / 5);
}

export function displayPoint<T extends [number, number, number]>(point: T, stacked: boolean): T {
  return [point[0], displayElevation(point[1], stacked), point[2]] as T;
}
