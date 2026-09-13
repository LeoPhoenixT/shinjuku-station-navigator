import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, InstancedMesh, Object3D, Vector3 } from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { routeLineSegmentPositions } from './routeLineGeometry.js';
import type { NetworkDirectionArrow } from './networkDirectionGeometry.js';
import type { StructuralLineStyle } from './structuralLinePresentation.js';
import type { ScenePoint3, SceneSegment } from './sceneGeometry.js';

export function Segments({ segments, color, yOffset, opacity = 1 }: { segments: SceneSegment[]; color: string; yOffset: number; opacity?: number }) {
  const geometry = useMemo(() => {
    const result = new BufferGeometry();
    result.setAttribute('position', new Float32BufferAttribute(segments.flatMap(([start, end]) => [start[0], start[1] + yOffset, start[2], end[0], end[1] + yOffset, end[2]]), 3));
    return result;
  }, [segments, yOffset]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <lineSegments geometry={geometry} renderOrder={1500}><lineBasicMaterial color={color} transparent={opacity < 1} opacity={opacity} /></lineSegments>;
}

export function WideSegments({ segments, color, yOffset, lineWidth, opacity, depthTest, renderOrder }: { segments: SceneSegment[]; color: string; yOffset: number; lineWidth: number; opacity: number; depthTest: boolean; renderOrder: number }) {
  const size = useThree((state) => state.size);
  const objects = useMemo(() => {
    const positions = segments.flatMap(([start, end]) => [start[0], start[1] + yOffset, start[2], end[0], end[1] + yOffset, end[2]]);
    if (positions.length < 6) return undefined;
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(positions);
    const material = new LineMaterial({ color, linewidth: lineWidth, transparent: opacity < 1, opacity, depthTest, depthWrite: false, toneMapped: false });
    const line = new LineSegments2(geometry, material);
    line.frustumCulled = false;
    line.renderOrder = renderOrder;
    return { geometry, material, line };
  }, [color, depthTest, lineWidth, opacity, renderOrder, segments, yOffset]);
  useLayoutEffect(() => {
    objects?.material.resolution.set(size.width, size.height);
  }, [objects, size.height, size.width]);
  useEffect(() => () => {
    objects?.geometry.dispose();
    objects?.material.dispose();
  }, [objects]);
  return objects ? <primitive object={objects.line} /> : null;
}

export function StructuralOverlay({ segments, style }: { segments: SceneSegment[]; style: StructuralLineStyle }) {
  return <>
    <WideSegments segments={segments} color={style.color} yOffset={style.yOffset} lineWidth={style.lineWidth} opacity={style.xrayOpacity} depthTest={false} renderOrder={style.renderOrder} />
    <WideSegments segments={segments} color={style.color} yOffset={style.yOffset} lineWidth={style.lineWidth} opacity={style.opacity} depthTest renderOrder={style.renderOrder + 1} />
  </>;
}

export function RouteLines({ lines, color, lineWidth, yOffset }: { lines: ScenePoint3[][]; color: string; lineWidth: number; yOffset: number }) {
  const objects = useMemo(() => {
    const positions = routeLineSegmentPositions(lines, yOffset);
    if (positions.length < 6) return undefined;
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(positions);
    const haloMaterial = new LineMaterial({ color: '#020617', linewidth: lineWidth + 4, depthTest: false, depthWrite: false, toneMapped: false });
    const lineMaterial = new LineMaterial({ color, linewidth: lineWidth, depthTest: false, depthWrite: false, toneMapped: false });
    const halo = new LineSegments2(geometry, haloMaterial);
    const line = new LineSegments2(geometry, lineMaterial);
    halo.frustumCulled = false;
    line.frustumCulled = false;
    halo.renderOrder = 9998;
    line.renderOrder = 9999;
    return { geometry, haloMaterial, lineMaterial, halo, line };
  }, [color, lines, lineWidth, yOffset]);
  useEffect(() => () => {
    objects?.geometry.dispose();
    objects?.haloMaterial.dispose();
    objects?.lineMaterial.dispose();
  }, [objects]);
  if (!objects) return null;
  return <>
    <primitive object={objects.halo} />
    <primitive object={objects.line} />
  </>;
}

export function NetworkDirectionArrows({ arrows, color = '#fef08a', yOffset = 0.72, scale = 1 }: { arrows: NetworkDirectionArrow[]; color?: string; yOffset?: number; scale?: number }) {
  const meshRef = useRef<InstancedMesh>(null);
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const transform = new Object3D();
    const up = new Vector3(0, 1, 0);
    arrows.forEach((arrow, index) => {
      transform.position.set(arrow.position[0], arrow.position[1] + yOffset, arrow.position[2]);
      transform.quaternion.setFromUnitVectors(up, new Vector3(...arrow.direction));
      transform.scale.setScalar(scale);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    invalidate();
  }, [arrows, invalidate, scale, yOffset]);
  if (arrows.length === 0) return null;
  return <instancedMesh ref={meshRef} args={[undefined, undefined, arrows.length]} frustumCulled={false}>
    <coneGeometry args={[0.42, 1.35, 8]} />
    <meshBasicMaterial color={color} toneMapped={false} />
  </instancedMesh>;
}
