import { useThree } from '@react-three/fiber';
import { useEffect, useRef, type RefObject } from 'react';
import { OrthographicCamera, Spherical, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  calculateTwoFingerDelta,
  cameraAzimuthAfterTwist,
  createTwoFingerSnapshot,
  MAX_CAMERA_POLAR_ANGLE,
  MIN_CAMERA_POLAR_ANGLE,
  shouldActivateTwist,
  type TouchPoint,
  type TwoFingerSnapshot,
} from './touchGestures.js';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 24;
const TILT_RADIANS_PER_PIXEL = 0.006;

interface MapTouchControlsProps {
  controlsRef: RefObject<OrbitControlsImpl | null>;
  rotationEnabled: boolean;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function MapTouchControls({ controlsRef, rotationEnabled }: MapTouchControlsProps) {
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const invalidate = useThree((state) => state.invalidate);
  const rotationEnabledRef = useRef(rotationEnabled);

  useEffect(() => {
    rotationEnabledRef.current = rotationEnabled;
  }, [rotationEnabled]);

  useEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return;

    const pointers = new Map<number, TouchPoint>();
    let previousSingle: TouchPoint | undefined;
    let previousPair: TwoFingerSnapshot | undefined;
    let accumulatedTwist = 0;
    let twistActive = false;
    let animationFrame: number | undefined;
    const right = new Vector3();
    const forward = new Vector3();
    const offset = new Vector3();
    const spherical = new Spherical();

    const resetBaseline = () => {
      const active = [...pointers.values()];
      previousSingle = active.length === 1 ? { ...active[0] } : undefined;
      previousPair = createTwoFingerSnapshot(active);
      accumulatedTwist = 0;
      twistActive = false;
    };

    const applyGestures = () => {
      animationFrame = undefined;
      const controls = controlsRef.current;
      if (!controls) {
        resetBaseline();
        return;
      }
      const active = [...pointers.values()];

      if (active.length === 1) {
        const current = active[0];
        if (previousSingle) {
          const deltaX = current.x - previousSingle.x;
          const deltaY = current.y - previousSingle.y;
          const worldPerPixelX = (camera.right - camera.left) / camera.zoom / Math.max(1, canvas.clientWidth);
          const worldPerPixelY = (camera.top - camera.bottom) / camera.zoom / Math.max(1, canvas.clientHeight);
          right.set(1, 0, 0).applyQuaternion(camera.quaternion).setY(0).normalize();
          camera.getWorldDirection(forward).setY(0).normalize();
          offset.copy(right).multiplyScalar(-deltaX * worldPerPixelX)
            .addScaledVector(forward, deltaY * worldPerPixelY);
          camera.position.add(offset);
          controls.target.add(offset);
        }
        previousSingle = { ...current };
        previousPair = undefined;
      } else if (active.length === 2) {
        const current = createTwoFingerSnapshot(active);
        if (current && previousPair) {
          const delta = calculateTwoFingerDelta(previousPair, current);
          camera.zoom = clamp(camera.zoom * delta.zoomRatio, MIN_ZOOM, MAX_ZOOM);
          camera.updateProjectionMatrix();

          if (rotationEnabledRef.current) {
            offset.copy(camera.position).sub(controls.target);
            spherical.setFromVector3(offset);
            accumulatedTwist += delta.twistRadians;
            if (!twistActive && shouldActivateTwist(accumulatedTwist)) twistActive = true;
            if (twistActive) spherical.theta = cameraAzimuthAfterTwist(spherical.theta, delta.twistRadians);
            spherical.phi = clamp(
              spherical.phi - delta.tiltPixels * TILT_RADIANS_PER_PIXEL,
              MIN_CAMERA_POLAR_ANGLE,
              MAX_CAMERA_POLAR_ANGLE,
            );
            offset.setFromSpherical(spherical);
            camera.position.copy(controls.target).add(offset);
          }
        }
        previousPair = current;
        previousSingle = undefined;
      } else {
        previousSingle = undefined;
        previousPair = undefined;
        accumulatedTwist = 0;
        twistActive = false;
      }

      controls.update();
      invalidate();
    };

    const scheduleGesture = () => {
      if (animationFrame === undefined) animationFrame = window.requestAnimationFrame(applyGestures);
    };

    const claimTouchEvent = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return false;
      event.preventDefault();
      event.stopImmediatePropagation();
      return true;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!claimTouchEvent(event)) return;
      pointers.set(event.pointerId, { id: event.pointerId, x: event.clientX, y: event.clientY });
      canvas.setPointerCapture(event.pointerId);
      resetBaseline();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!claimTouchEvent(event) || !pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { id: event.pointerId, x: event.clientX, y: event.clientY });
      scheduleGesture();
    };
    const onPointerEnd = (event: PointerEvent) => {
      if (!claimTouchEvent(event)) return;
      pointers.delete(event.pointerId);
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      resetBaseline();
    };

    const listenerOptions: AddEventListenerOptions = { capture: true, passive: false };
    canvas.addEventListener('pointerdown', onPointerDown, listenerOptions);
    canvas.addEventListener('pointermove', onPointerMove, listenerOptions);
    canvas.addEventListener('pointerup', onPointerEnd, listenerOptions);
    canvas.addEventListener('pointercancel', onPointerEnd, listenerOptions);
    return () => {
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
      canvas.removeEventListener('pointerdown', onPointerDown, listenerOptions);
      canvas.removeEventListener('pointermove', onPointerMove, listenerOptions);
      canvas.removeEventListener('pointerup', onPointerEnd, listenerOptions);
      canvas.removeEventListener('pointercancel', onPointerEnd, listenerOptions);
    };
  }, [camera, canvas, controlsRef, invalidate]);

  return null;
}
