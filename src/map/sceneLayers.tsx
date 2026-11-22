import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, type CSSProperties } from 'react';
import { DoubleSide } from 'three';
import type { ProcessedFeature } from '../types/processed.js';
import { FLOOR_SURFACE_HEIGHT_METERS, floorMeshRenderOrder } from './floorRendering.js';
import { FIXTURE_PRESENTATION_STYLES, groupFixtureFeatures, type FixturePresentationStyle } from './fixturePresentation.js';
import { createExtrudedGeometry, featureSegments, floorCalloutAnchor } from './sceneGeometry.js';
import { SPACE_PRESENTATION_STYLES, groupSpaceFeatures } from './spacePresentation.js';
import { Segments, WideSegments } from './sceneLinePrimitives.js';
import { floorMapCode, floorPaletteFor } from './viewerPresentation.js';
import { wallEnvelopeSegments } from './wallEnvelope.js';

type ExtrudedLayerName = 'Floor' | 'Space' | 'Fixture';

function ExtrudedFloorMesh({ features, layer, floorId, stacked, color, opacity, renderOrder, height, offset }: { features: ProcessedFeature[]; layer: ExtrudedLayerName; floorId: string; stacked: boolean; color: string; opacity: number; renderOrder: number; height?: number; offset?: number }) {
  const geometry = useMemo(() => createExtrudedGeometry(features, layer, [floorId], stacked, height === undefined || offset === undefined ? undefined : { height, offset }), [features, floorId, height, layer, offset, stacked]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return <mesh geometry={geometry} renderOrder={renderOrder} receiveShadow={layer !== 'Fixture'} castShadow={layer === 'Fixture'}><meshStandardMaterial color={color} side={DoubleSide} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} roughness={0.82} metalness={0.02} /></mesh>;
}

export function FloorStructure({ features, floorId, floorIndex, stacked, focused }: { features: ProcessedFeature[]; floorId: string; floorIndex: number; stacked: boolean; focused: boolean }) {
  const container = useThree(({ gl }) => gl.domElement.parentElement);
  const portal = container ? { current: container } : undefined;
  const { outline, slab } = floorPaletteFor(floorId);
  const floor = useMemo(() => featureSegments(features, 'Floor', [floorId], stacked), [features, floorId, stacked]);
  const spaces = useMemo(() => featureSegments(features, 'Space', [floorId], stacked), [features, floorId, stacked]);
  const envelope = useMemo(() => wallEnvelopeSegments(features, [floorId], stacked), [features, floorId, stacked]);
  // Keep the B1 callout on the west concourse, clear of the central gate cluster.
  const anchor = useMemo(() => floorCalloutAnchor(features, floorId, stacked, floorId === 'B1' ? 'west' : 'east'), [features, floorId, stacked]);
  const placeLeft = floorId === 'B2' || floorId === 'B3';

  return <>
    <ExtrudedFloorMesh features={features} layer="Floor" floorId={floorId} stacked={stacked} color={slab} opacity={1} renderOrder={floorMeshRenderOrder(false, floorIndex, 0)} />
    <Segments segments={envelope} color={outline} yOffset={0.32} opacity={focused ? 0.42 : 0.24} />
    <Segments segments={spaces} color={outline} yOffset={0.45} opacity={focused ? 0.64 : 0.38} />
    <WideSegments segments={floor} color={outline} yOffset={0.32} lineWidth={1} opacity={0.12} depthTest={false} renderOrder={2010} />
    <WideSegments segments={floor} color={outline} yOffset={0.32} lineWidth={focused ? 2.7 : 1.9} opacity={focused ? 0.98 : 0.89} depthTest renderOrder={2011} />
    {anchor && <Html portal={portal} position={[anchor[0], anchor[1] + FLOOR_SURFACE_HEIGHT_METERS, anchor[2]]} zIndexRange={[3, 1]} wrapperClass="floor-callout-layer" pointerEvents="none">
      <span className={`floor-callout${placeLeft ? ' floor-callout-left' : ''}`} data-map-floor={floorId} aria-hidden="true" style={{ '--floor-accent': outline } as CSSProperties}>
        <span className="floor-callout-leader" />
        <span className="floor-callout-code">{floorMapCode(floorId)}</span>
      </span>
    </Html>}
  </>;
}

export function SemanticSpaceLayer({ features, floors, stacked, overview }: { features: ProcessedFeature[]; floors: string[]; stacked: boolean; overview: boolean }) {
  const grouped = useMemo(() => groupSpaceFeatures(features), [features]);
  const byGroup = useMemo(() => new Map([...grouped].map(([presentation, groupFeatures]) => [presentation.group, { presentation, groupFeatures }])), [grouped]);
  return <>{floors.flatMap((floorId, floorIndex) => SPACE_PRESENTATION_STYLES.map((style, styleIndex) => {
    const batch = byGroup.get(style.group);
    if (!batch) return null;
    return <ExtrudedFloorMesh
      key={`${floorId}:Space:${style.group}`}
      features={batch.groupFeatures}
      layer="Space"
      floorId={floorId}
      stacked={stacked}
      color={style.color}
      opacity={overview ? style.opacity * 0.58 : style.opacity}
      height={style.height}
      offset={style.offset}
      renderOrder={floorMeshRenderOrder(false, floorIndex, 1) + styleIndex / 100}
    />;
  }))}</>;
}

function FixtureBatch({ features, floors, stacked, context, style, styleIndex }: { features: ProcessedFeature[]; floors: string[]; stacked: boolean; context: boolean; style: FixturePresentationStyle; styleIndex: number }) {
  const outlines = useMemo(() => featureSegments(features, 'Fixture', floors, stacked), [features, floors, stacked]);
  const outlineOpacity = context ? 0.18 : style.priority === 'structure' ? 0.9 : style.priority === 'barrier' ? 0.72 : 0.34;
  return <>
    {!context && floors.map((floorId, floorIndex) => <ExtrudedFloorMesh
      key={`${floorId}:Fixture:${style.group}`}
      features={features}
      layer="Fixture"
      floorId={floorId}
      stacked={stacked}
      color={style.color}
      opacity={style.opacity}
      height={style.height}
      offset={style.offset}
      renderOrder={floorMeshRenderOrder(false, floorIndex, 2) + styleIndex / 100}
    />)}
    <Segments segments={outlines} color={style.outlineColor} yOffset={style.offset + style.height + 0.04} opacity={outlineOpacity} />
  </>;
}

export function SemanticFixtureLayer({ features, floors, stacked, context = false }: { features: ProcessedFeature[]; floors: string[]; stacked: boolean; context?: boolean }) {
  const grouped = useMemo(() => groupFixtureFeatures(features), [features]);
  const byGroup = useMemo(() => new Map([...grouped].map(([presentation, groupFeatures]) => [presentation.group, groupFeatures])), [grouped]);
  return <>{FIXTURE_PRESENTATION_STYLES.map((style, styleIndex) => {
    const batch = byGroup.get(style.group);
    return batch ? <FixtureBatch key={style.group} features={batch} floors={floors} stacked={stacked} context={context} style={style} styleIndex={styleIndex} /> : null;
  })}</>;
}
