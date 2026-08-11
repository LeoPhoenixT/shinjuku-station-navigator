const DEFAULT_PADDING = 1.12;
const DEFAULT_CAMERA_CLEARANCE_PADDING = 1.1;
const FALLBACK_CAMERA_DISTANCE = 220;

export const ANGLED_CAMERA_POLAR_ANGLE = 55 * Math.PI / 180;

export function calculateOrthographicFitZoom(
  viewportWidth: number,
  viewportHeight: number,
  contentWidth: number,
  contentHeight: number,
  padding = DEFAULT_PADDING,
): number {
  if (viewportWidth <= 0 || viewportHeight <= 0 || contentWidth <= 0 || contentHeight <= 0 || padding < 1) {
    return 1;
  }

  return Math.min(
    viewportWidth / (contentWidth * padding),
    viewportHeight / (contentHeight * padding),
  );
}

export function calculateCameraClearanceDistance(
  contentWidth: number,
  contentHeight: number,
  contentDepth: number,
  padding = DEFAULT_CAMERA_CLEARANCE_PADDING,
): number {
  if (contentWidth <= 0 || contentHeight < 0 || contentDepth <= 0 || padding < 1) {
    return FALLBACK_CAMERA_DISTANCE;
  }

  return Math.hypot(contentWidth, contentHeight, contentDepth) * padding + 1;
}

export function calculateAngledContentHeight(
  contentHeight: number,
  contentDepth: number,
  polarAngle: number,
): number {
  if (contentHeight < 0 || contentDepth <= 0 || polarAngle < 0 || polarAngle >= Math.PI / 2) {
    return contentDepth;
  }

  return contentDepth * Math.cos(polarAngle) + contentHeight * Math.sin(polarAngle);
}
