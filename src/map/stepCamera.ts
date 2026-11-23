import { Vector3, type OrthographicCamera } from 'three';
import type { MapBounds } from './mapBounds.js';
import { displayElevation } from './stackedElevation.js';

export function panToStepIfOutsideView(
  camera: OrthographicCamera,
  target: Vector3,
  bounds: MapBounds,
  datasetBounds: MapBounds,
  stacked: boolean,
): boolean {
  const center = new Vector3(
    (bounds.minX + bounds.maxX - datasetBounds.minX - datasetBounds.maxX) / 2,
    displayElevation((bounds.minY + bounds.maxY) / 2, stacked),
    (bounds.minZ + bounds.maxZ - datasetBounds.minZ - datasetBounds.maxZ) / 2,
  );
  camera.updateMatrixWorld();
  const projected = center.clone().project(camera);
  if (Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1) return false;

  // Move the step just inside the viewport while preserving the map's orientation and scale.
  projected.x = Math.max(-0.8, Math.min(0.8, projected.x));
  projected.y = Math.max(-0.8, Math.min(0.8, projected.y));
  const offset = center.sub(projected.unproject(camera));
  target.add(offset);
  camera.position.add(offset);
  camera.updateMatrixWorld();
  return true;
}
