export interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

export interface TwoFingerSnapshot {
  first: TouchPoint;
  second: TouchPoint;
  distance: number;
  angle: number;
}

export interface TwoFingerDelta {
  twistRadians: number;
  zoomRatio: number;
  tiltPixels: number;
}

export const MAX_CAMERA_POLAR_ANGLE = 75 * Math.PI / 180;
export const MIN_CAMERA_POLAR_ANGLE = 0.01;
export const TWIST_ACTIVATION_RADIANS = 3 * Math.PI / 180;

export function createTwoFingerSnapshot(points: Iterable<TouchPoint>): TwoFingerSnapshot | undefined {
  const sorted = [...points].sort((left, right) => left.id - right.id);
  if (sorted.length !== 2) return undefined;
  const [first, second] = sorted;
  const deltaX = second.x - first.x;
  const deltaY = second.y - first.y;
  return {
    first,
    second,
    distance: Math.hypot(deltaX, deltaY),
    angle: Math.atan2(deltaY, deltaX),
  };
}

export function normalizeAngleDelta(radians: number) {
  return Math.atan2(Math.sin(radians), Math.cos(radians));
}

export function cameraAzimuthAfterTwist(azimuth: number, twistRadians: number) {
  return azimuth + twistRadians;
}

export function shouldActivateTwist(accumulatedTwistRadians: number) {
  return Math.abs(accumulatedTwistRadians) >= TWIST_ACTIVATION_RADIANS;
}

export function calculateTwoFingerDelta(previous: TwoFingerSnapshot, current: TwoFingerSnapshot): TwoFingerDelta {
  const firstDeltaY = current.first.y - previous.first.y;
  const secondDeltaY = current.second.y - previous.second.y;
  const fingersMoveVerticallyTogether = firstDeltaY * secondDeltaY > 0;

  return {
    twistRadians: normalizeAngleDelta(current.angle - previous.angle),
    zoomRatio: previous.distance > 0 ? current.distance / previous.distance : 1,
    tiltPixels: fingersMoveVerticallyTogether ? (firstDeltaY + secondDeltaY) / 2 : 0,
  };
}
