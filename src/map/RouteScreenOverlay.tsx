import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { Vector3 } from 'three';
import type { RoutingGraph } from '../graph/types.js';
import type { RoutePlan } from '../routing/routeService.js';
import type { ProcessedDataset } from '../types/processed.js';
import { routePolylines, routeTransitionPolylines } from './routeLineGeometry.js';

interface RouteScreenOverlayProps {
  route: RoutePlan;
  visibleFloors: string[];
  floor: ProcessedDataset;
  routingGraph: RoutingGraph;
  haloPathRef: RefObject<SVGPathElement | null>;
  routePathRef: RefObject<SVGPathElement | null>;
  transitionHaloPathRef: RefObject<SVGPathElement | null>;
  transitionPathRef: RefObject<SVGPathElement | null>;
}

interface ProjectionState {
  routeLines: Array<Array<readonly [number, number, number]>>;
  transitionLines: Array<Array<readonly [number, number, number]>>;
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
  const transitionLines = useMemo(() => routeTransitionPolylines(props.route, props.routingGraph, props.visibleFloors, stacked), [props.route, props.routingGraph, props.visibleFloors, stacked]);
  const center = useMemo(() => {
    const { minX, maxX, minZ, maxZ } = props.floor.statistics.bounds;
    return [-(minX + maxX) / 2, 0, -(minZ + maxZ) / 2] as const;
  }, [props.floor.statistics.bounds]);
  const worldLines = useMemo(() => lines.map((line) => line.map((point) => [point[0] + center[0], point[1] + 3.9, point[2] + center[2]] as const)), [center, lines]);
  const worldTransitionLines = useMemo(() => transitionLines.map((line) => line.map((point) => [point[0] + center[0], point[1] + 4, point[2] + center[2]] as const)), [center, transitionLines]);
  const vector = useMemo(() => new Vector3(), []);
  const previousProjectionRef = useRef<ProjectionState | undefined>(undefined);
  const previousPathsRef = useRef({ route: '', transition: '' });

  useEffect(() => () => {
    props.haloPathRef.current?.setAttribute('d', '');
    props.routePathRef.current?.setAttribute('d', '');
    props.transitionHaloPathRef.current?.setAttribute('d', '');
    props.transitionPathRef.current?.setAttribute('d', '');
    previousProjectionRef.current = undefined;
    previousPathsRef.current = { route: '', transition: '' };
  }, [props.haloPathRef, props.routePathRef, props.transitionHaloPathRef, props.transitionPathRef]);

  useFrame(() => {
    const previous = previousProjectionRef.current;
    if (previous
      && previous.routeLines === worldLines
      && previous.transitionLines === worldTransitionLines
      && previous.width === size.width
      && previous.height === size.height
      && !matrixChanged(previous.matrixWorld, camera.matrixWorld.elements)
      && !matrixChanged(previous.projectionMatrix, camera.projectionMatrix.elements)) return;

    previousProjectionRef.current = {
      routeLines: worldLines,
      transitionLines: worldTransitionLines,
      matrixWorld: camera.matrixWorld.elements.slice(),
      projectionMatrix: camera.projectionMatrix.elements.slice(),
      width: size.width,
      height: size.height,
    };
    const project = (projectedLines: typeof worldLines) => projectedLines.flatMap((line) => line.map((point, index) => {
      vector.set(...point).project(camera);
      const x = (vector.x * 0.5 + 0.5) * size.width;
      const y = (-vector.y * 0.5 + 0.5) * size.height;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })).join(' ');
    const routePath = project(worldLines);
    const transitionPath = project(worldTransitionLines);
    if (routePath !== previousPathsRef.current.route) {
      props.haloPathRef.current?.setAttribute('d', routePath);
      props.routePathRef.current?.setAttribute('d', routePath);
    }
    if (transitionPath !== previousPathsRef.current.transition) {
      props.transitionHaloPathRef.current?.setAttribute('d', transitionPath);
      props.transitionPathRef.current?.setAttribute('d', transitionPath);
    }
    previousPathsRef.current = { route: routePath, transition: transitionPath };
  });

  return null;
}
