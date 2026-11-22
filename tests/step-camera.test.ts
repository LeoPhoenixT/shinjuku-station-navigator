import { OrthographicCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { panToStepIfOutsideView } from '../src/map/stepCamera';

const dataset = { minX: -100, maxX: 100, minY: 0, maxY: 0, minZ: -100, maxZ: 100 };
const bounds = (x: number) => ({ minX: x, maxX: x, minY: 0, maxY: 0, minZ: 0, maxZ: 0 });

describe('step camera', () => {
  it('pans only when the step is out of view and preserves the view angle and zoom', () => {
    const camera = new OrthographicCamera(-10, 10, 10, -10, 0.1, 500);
    const target = new Vector3();
    camera.position.set(15, 30, 20);
    camera.lookAt(target);
    camera.zoom = 2;
    camera.updateProjectionMatrix();
    const position = camera.position.clone();
    const orientation = camera.quaternion.clone();
    expect(panToStepIfOutsideView(camera, target, bounds(0), dataset, false)).toBe(false);
    expect(camera.position).toEqual(position);

    expect(panToStepIfOutsideView(camera, target, bounds(30), dataset, false)).toBe(true);
    expect(camera.quaternion.equals(orientation)).toBe(true);
    expect(camera.zoom).toBe(2);
    expect(camera.position.clone().sub(target).distanceTo(position)).toBeLessThan(1e-8);
    expect(Math.abs(new Vector3(30, 0, 0).project(camera).x)).toBeLessThan(1);
  });
});
