import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { useI18n } from '../i18n/context.js';
import type { SurfaceContext, SurfacePath } from '../schema/surfaceContext.js';
import type { SceneSegment } from './sceneGeometry.js';
import { WideSegments } from './sceneLinePrimitives.js';
import { SURFACE_LANDMARK_COLOR, SURFACE_ROAD_COLOR } from './viewerPresentation.js';

function roadSegments(paths: SurfacePath[]): SceneSegment[] {
  return paths.flatMap((path) => path.slice(1).map(([x, z], index): SceneSegment => [
    [path[index][0], 0, path[index][1]],
    [x, 0, z],
  ]));
}

export function SurfaceContextLayer({ data, muted }: { data: SurfaceContext; muted: boolean }) {
  const { t } = useI18n();
  const container = useThree(({ gl }) => gl.domElement.parentElement);
  // Keep landmark portals attached where Fiber connects pointer events.
  const portal = container ? { current: container } : undefined;
  const edges = useMemo(() => roadSegments(data.roadEdges), [data.roadEdges]);
  const medians = useMemo(() => roadSegments(data.roadMedians), [data.roadMedians]);
  return <>
    <WideSegments segments={edges} color={SURFACE_ROAD_COLOR} lineWidth={1.1} opacity={muted ? 0.3 : 0.59} yOffset={0.06} depthTest renderOrder={1450} />
    <WideSegments segments={medians} color={SURFACE_ROAD_COLOR} lineWidth={1} opacity={muted ? 0.22 : 0.39} yOffset={0.06} depthTest renderOrder={1450} />
    {data.landmarks.map(({ id, position: [x, z] }) => (
      <Html key={id} portal={portal} position={[x, 0.2, z]} center zIndexRange={[3, 1]} wrapperClass="surface-landmark-layer">
        <span className="surface-landmark" style={{ color: SURFACE_LANDMARK_COLOR }}>{t(`landmark.${id}`)}</span>
      </Html>
    ))}
  </>;
}
