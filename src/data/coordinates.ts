export interface GeoPoint { lon: number; lat: number }
export interface LocalPoint { x: number; y: number; z: number }

export const SHINJUKU_LOCAL_ORIGIN: GeoPoint = { lon: 139.7006, lat: 35.6909 };
export const EARTH_RADIUS_METERS = 6_378_137;

export function lonLatToLocalMeters(point: GeoPoint, origin: GeoPoint = SHINJUKU_LOCAL_ORIGIN, elevationMeters = 0): LocalPoint {
  const radians = Math.PI / 180;
  const x = (point.lon - origin.lon) * radians * EARTH_RADIUS_METERS * Math.cos(origin.lat * radians);
  const north = (point.lat - origin.lat) * radians * EARTH_RADIUS_METERS;
  return { x: roundMillimeter(x), y: elevationMeters, z: roundMillimeter(-north) };
}

export function roundMillimeter(value: number): number {
  return Math.round(value * 1000) / 1000;
}
