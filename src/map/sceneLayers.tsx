import { useEffect, useMemo } from 'react';
import { DoubleSide } from 'three';
import type { ProcessedFeature } from '../types/processed.js';
import { floorMeshRenderOrder } from './floorRendering.js';
import { FIXTURE_PRESENTATION_STYLES, groupFixtureFeatures, type FixturePresentationStyle } from './fixturePresentation.js';
import { createExtrudedGeometry, featureSegments } from './sceneGeometry.js';
import { SPACE_PRESENTATION_STYLES, groupSpaceFeatures } from './spacePresentation.js';
import { Segments } from './sceneLinePrimitives.js';

type ExtrudedLayerName = 'Floor' | 'Space' | 'Fixture';

function ExtrudedFloorMesh({ features, layer, floorId, stacked, color, opacity, renderOrder, height, offset }: { features: ProcessedFeature[]; layer: ExtrudedLayerName; floorId: string; stacked: boolean; color: string; opacity: number; renderOrder: number; height?: number; offset?: number }) {
  const geometry = useMemo(() => createExtrudedGeometry(features, layer, [floorId], stacked, height === undefined || offset === undefined ? undefined : { height, offset }), [features, floorId, height, layer, offset, stacked]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return <mesh geometry={geometry} renderOrder={renderOrder} receiveShadow={layer !== 'Fixture'} castShadow={layer === 'Fixture'}><meshStandardMaterial color={color} side={DoubleSide} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} roughness={0.82} metalness={0.02} /></mesh>;
}

export function ExtrudedLayer({ features, layer, floors, stacked, color, opacity = 1, context = false }: { features: ProcessedFeature[]; layer: ExtrudedLayerName; floors: string[]; stacked: boolean; color: string; opacity?: number; context?: boolean }) {
  const layerIndex = layer === 'Floor' ? 0 : layer === 'Space' ? 1 : 2;
  return <>{floors.map((floorId, floorIndex) => <ExtrudedFloorMesh key={`${floorId}:${layer}`} features={features} layer={layer} floorId={floorId} stacked={stacked} color={color} opacity={opacity} renderOrder={floorMeshRenderOrder(context, floorIndex, layerIndex)} />)}</>;
}

export function SemanticSpaceLayer({ features, floors, stacked, context = false }: { features: ProcessedFeature[]; floors: string[]; stacked: boolean; context?: boolean }) {
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
      opacity={context ? style.opacity * 0.3 : style.opacity}
      height={style.height}
      offset={style.offset}
      renderOrder={floorMeshRenderOrder(context, floorIndex, 1) + styleIndex / 100}
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
