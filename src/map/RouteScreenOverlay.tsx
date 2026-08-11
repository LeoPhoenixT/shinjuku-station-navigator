import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { Vector3 } from 'three';
import type { RoutePlan } from '../routing/routeService.js';
import type { ProcessedDataset } from '../types/processed.js';
import { routePolylines } from './routeLineGeometry.js';

interface RouteScreenOverlayProps {
  route: RoutePlan;
  visibleFloors: string[];
  floor: ProcessedDataset;
  haloPathRef: RefObject<SVGPathElement | null>;
  routePathRef: RefObject<SVGPathElement | null>;
}

interface ProjectionState {
  lines: Array<Array<readonly [number, number, number]>>;
  matrixWorld: number[];
  projectionMatrix: number[];
  width: number;
  height: number;
}

function matrixChanged(previous: number[], current: readonly number[]): boolean {
  return previous.some((value, index) => value !== current[index]);
}

export function RouteScreenOverlay(props: RouteScreenOverlayProps) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const stacked = props.visibleFloors.length > 1;
  const lines = useMemo(() => routePolylines(props.route, props.visibleFloors, stacked), [props.route, props.visibleFloors, stacked]);
  const center = useMemo(() => {
    const { minX, maxX, minZ, maxZ } = props.floor.statistics.bounds;
    return [-(minX + maxX) / 2, 0, -(minZ + maxZ) / 2] as const;
  }, [props.floor.statistics.bounds]);
  const worldLines = useMemo(() => lines.map((line) => line.map((point) => [point[0] + center[0], point[1] + 3.9, point[2] + center[2]] as const)), [center, lines]);
  const vector = useMemo(() => new Vector3(), []);
  const previousProjectionRef = useRef<ProjectionState | undefined>(undefined);
  const previousPathRef = useRef('');

  useEffect(() => () => {
    props.haloPathRef.current?.setAttribute('d', '');
    props.routePathRef.current?.setAttribute('d', '');
    previousProjectionRef.current = undefined;
    previousPathRef.current = '';
  }, [props.haloPathRef, props.routePathRef]);

  useFrame(() => {
    const previous = previousProjectionRef.current;
    if (previous
      && previous.lines === worldLines
      && previous.width === size.width
      && previous.height === size.height
      && !matrixChanged(previous.matrixWorld, camera.matrixWorld.elements)
      && !matrixChanged(previous.projectionMatrix, camera.projectionMatrix.elements)) return;

    previousProjectionRef.current = {
      lines: worldLines,
      matrixWorld: camera.matrixWorld.elements.slice(),
      projectionMatrix: camera.projectionMatrix.elements.slice(),
      width: size.width,
      height: size.height,
    };
    const commands: string[] = [];
    for (const line of worldLines) for (let index = 0; index < line.length; index += 1) {
      vector.set(...line[index]).project(camera);
      const x = (vector.x * 0.5 + 0.5) * size.width;
      const y = (-vector.y * 0.5 + 0.5) * size.height;
      commands.push(`${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    const path = commands.join(' ');
    if (path === previousPathRef.current) return;
    previousPathRef.current = path;
    props.haloPathRef.current?.setAttribute('d', path);
    props.routePathRef.current?.setAttribute('d', path);
  });

  return null;
}
