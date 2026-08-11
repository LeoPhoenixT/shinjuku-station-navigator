import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BufferGeometry, DoubleSide, ExtrudeGeometry, Float32BufferAttribute, InstancedMesh, Object3D, Shape, Vector3 } from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { RoutingGraph } from '../graph/types.js';
import type { RoutePlan } from '../routing/routeService.js';
import type { NamedPlaceRecord } from '../schema/processed.js';
import type { OfficialNetworkDataset } from '../types/officialNetwork.js';
import type { ProcessedDataset, ProcessedFeature } from '../types/processed.js';
import { floorDisplayName, floorLongName, publicAreaName, publicPlaceName } from '../places/placePresentation.js';
import type { PlaceTranslationsDataset } from '../schema/placeTranslations.js';
import { useI18n } from '../i18n/context.js';
import { formatIndoorMapCategory, formatMovement } from '../i18n/formatters.js';
import { displayElevation, displayPoint } from './stackedElevation.js';
import { wallEnvelopeSegments } from './wallEnvelope.js';
import { routeDirectionCues, routeLineSegmentPositions, routePolylines, routeTransitionMarkers, routeTransitionPolylines } from './routeLineGeometry.js';
import { classifyNetworkEdgeContext } from './networkContext.js';
import { networkDirectionArrows, type NetworkDirectionArrow } from './networkDirectionGeometry.js';
import { FLOOR_SKIRT_HEIGHT_METERS, FLOOR_SKIRT_OFFSET_METERS, floorMeshRenderOrder } from './floorRendering.js';
import { groupSpaceFeatures, SPACE_PRESENTATION_STYLES, spacePresentationStyle, type SpacePresentationStyle } from './spacePresentation.js';
import { FIXTURE_PRESENTATION_STYLES, groupFixtureFeatures, type FixturePresentationStyle } from './fixturePresentation.js';
import { STRUCTURAL_LINE_STYLES, type StructuralLineStyle } from './structuralLinePresentation.js';
import { routablePlaceForFacility, selectVisibleFacilityMarkers, type FacilityMarkerCandidate } from './facilityMarkers.js';
import { facilityMarkerMatchesPreferences, placeHasPermanentLabel, type FloorViewMode } from './displayPreferences.js';
import { allSourceLinkSegments } from './debugNetwork.js';
import { partitionVisibleFloors } from './viewerPresentation.js';

type Point3 = [number, number, number];
type Segment = [Point3, Point3];

export interface MapSceneProps {
  activeFloor: string;
  floorViewMode: FloorViewMode;
  routeFloorIds: string[];
  facilityMarkerCandidates: FacilityMarkerCandidate[];
  floor: ProcessedDataset;
  officialNetwork: OfficialNetworkDataset;
  routingGraph: RoutingGraph;
  twsiGraph: RoutingGraph;
  places: NamedPlaceRecord[];
  translations?: PlaceTranslationsDataset;
  route: RoutePlan;
  startId: string;
  destinationId: string;
  highlightedRouteEdgeIds: string[];
  debug: boolean;
  showAllSourceLinks: boolean;
  showOfficialNetwork: boolean;
  showOfficialNodes: boolean;
  showTwsi: boolean;
  showFacilities: boolean;
  enabledFacilityCategories: ReadonlySet<string>;
  showGateLabels: boolean;
  showStructuralDetails: boolean;
  visibleFloors: string[];
  onFacilityRouteAction: (place: NamedPlaceRecord, target: 'start' | 'destination') => void;
}

function centerOf(dataset: ProcessedDataset): Point3 {
  const { minX, maxX, minZ, maxZ } = dataset.statistics.bounds;
  return [-(minX + maxX) / 2, 0, -(minZ + maxZ) / 2];
}

function featureSegments(features: ProcessedFeature[], layer: ProcessedFeature['layer'], floors: string[], stacked: boolean): Segment[] {
  return features.filter((feature) => floors.includes(feature.floorId ?? 'B1') && feature.layer === layer && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'PolyLine')).flatMap((feature) => feature.geometry.type === 'Point' ? [] : feature.geometry.parts.flatMap((part) => part.slice(1).map((point, index) => [displayPoint(part[index], stacked), displayPoint(point, stacked)] as Segment)));
}

const DISPLAY_HEIGHTS: Partial<Record<ProcessedFeature['layer'], { height: number; offset: number }>> = {
  Floor: { height: FLOOR_SKIRT_HEIGHT_METERS, offset: FLOOR_SKIRT_OFFSET_METERS },
  Space: { height: 0.18, offset: 0.3 },
};
const WALKING_NETWORK_HEIGHT = 1.15;
const WALKING_NETWORK_ARROW_HEIGHT = 1.55;

function extrudedGeometry(features: ProcessedFeature[], layer: 'Floor' | 'Space' | 'Fixture', floors: string[], stacked: boolean, style = DISPLAY_HEIGHTS[layer]!): BufferGeometry | undefined {
  const geometries = features.filter((feature) => feature.layer === layer && floors.includes(feature.floorId ?? 'B1') && feature.geometry.type === 'Polygon').flatMap((feature) => feature.geometry.type !== 'Polygon' ? [] : feature.geometry.parts.flatMap((part) => {
    if (part.length < 3) return [];
    const shape = new Shape();
    shape.moveTo(part[0][0], -part[0][2]);
    for (const point of part.slice(1)) shape.lineTo(point[0], -point[2]);
    const geometry = new ExtrudeGeometry(shape, { depth: style.height, bevelEnabled: false, curveSegments: 1, steps: 1 });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, displayElevation(part[0][1], stacked) + style.offset, 0);
    return [geometry];
  }));
  if (geometries.length === 0) return undefined;
  const merged = mergeGeometries(geometries, false) ?? undefined;
  geometries.forEach((geometry) => geometry.dispose());
  merged?.computeVertexNormals();
  return merged;
}

function ExtrudedFloorMesh({ features, layer, floorId, stacked, color, opacity, renderOrder, height, offset }: { features: ProcessedFeature[]; layer: 'Floor' | 'Space' | 'Fixture'; floorId: string; stacked: boolean; color: string; opacity: number; renderOrder: number; height?: number; offset?: number }) {
  const geometry = useMemo(() => extrudedGeometry(features, layer, [floorId], stacked, height === undefined || offset === undefined ? undefined : { height, offset }), [features, floorId, height, layer, offset, stacked]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return <mesh geometry={geometry} renderOrder={renderOrder} receiveShadow={layer !== 'Fixture'} castShadow={layer === 'Fixture'}><meshStandardMaterial color={color} side={DoubleSide} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} roughness={0.82} metalness={0.02} /></mesh>;
}

function ExtrudedLayer({ features, layer, floors, stacked, color, opacity = 1, context = false }: { features: ProcessedFeature[]; layer: 'Floor' | 'Space' | 'Fixture'; floors: string[]; stacked: boolean; color: string; opacity?: number; context?: boolean }) {
  const layerIndex = layer === 'Floor' ? 0 : layer === 'Space' ? 1 : 2;
  return <>{floors.map((floorId, floorIndex) => <ExtrudedFloorMesh key={`${floorId}:${layer}`} features={features} layer={layer} floorId={floorId} stacked={stacked} color={color} opacity={opacity} renderOrder={floorMeshRenderOrder(context, floorIndex, layerIndex)} />)}</>;
}

function SemanticSpaceLayer({ features, floors, stacked, context = false }: { features: ProcessedFeature[]; floors: string[]; stacked: boolean; context?: boolean }) {
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

function emphasizedSpaceSegments(features: ProcessedFeature[], emphasis: SpacePresentationStyle['emphasis'], floors: string[], stacked: boolean): Segment[] {
  return featureSegments(features.filter((feature) => feature.layer === 'Space' && spacePresentationStyle(feature.properties.category).emphasis === emphasis), 'Space', floors, stacked);
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

function SemanticFixtureLayer({ features, floors, stacked, context = false }: { features: ProcessedFeature[]; floors: string[]; stacked: boolean; context?: boolean }) {
  const grouped = useMemo(() => groupFixtureFeatures(features), [features]);
  const byGroup = useMemo(() => new Map([...grouped].map(([presentation, groupFeatures]) => [presentation.group, groupFeatures])), [grouped]);
  return <>{FIXTURE_PRESENTATION_STYLES.map((style, styleIndex) => {
    const batch = byGroup.get(style.group);
    return batch ? <FixtureBatch key={style.group} features={batch} floors={floors} stacked={stacked} context={context} style={style} styleIndex={styleIndex} /> : null;
  })}</>;
}

function graphSegments(graph: RoutingGraph, floors: string[], stacked: boolean): Segment[] {
  return graph.edges.filter((edge) => floors.includes(edge.floorFrom) && floors.includes(edge.floorTo)).flatMap((edge) => edge.geometry.slice(1).map((point, index) => [displayPoint(edge.geometry[index], stacked), displayPoint(point, stacked)] as Segment));
}

function graphContextSegments(graph: RoutingGraph, floors: string[], stacked: boolean): Record<'inside' | 'boundary' | 'outside', Segment[]> {
  const result = { inside: [] as Segment[], boundary: [] as Segment[], outside: [] as Segment[] };
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const edge of graph.edges) {
    if (!floors.includes(edge.floorFrom) || !floors.includes(edge.floorTo)) continue;
    const context = classifyNetworkEdgeContext(edge, nodes);
    result[context].push(...edge.geometry.slice(1).map((point, index) => [displayPoint(edge.geometry[index], stacked), displayPoint(point, stacked)] as Segment));
  }
  return result;
}

function outdoorFeature(feature: ProcessedFeature): boolean {
  return typeof feature.properties.sourceFloor === 'string' && feature.properties.sourceFloor.toLowerCase().endsWith('out');
}

function outdoorFeatureSegments(features: ProcessedFeature[], floors: string[], stacked: boolean): Segment[] {
  const outdoorFeatures = features.filter(outdoorFeature);
  return ['Floor', 'Space', 'Fixture', 'Opening'].flatMap((layer) => featureSegments(outdoorFeatures, layer as ProcessedFeature['layer'], floors, stacked));
}

function Segments({ segments, color, yOffset, opacity = 1 }: { segments: Segment[]; color: string; yOffset: number; opacity?: number }) {
  const geometry = useMemo(() => {
    const result = new BufferGeometry();
    result.setAttribute('position', new Float32BufferAttribute(segments.flatMap(([start, end]) => [start[0], start[1] + yOffset, start[2], end[0], end[1] + yOffset, end[2]]), 3));
    return result;
  }, [segments, yOffset]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <lineSegments geometry={geometry} renderOrder={1500}><lineBasicMaterial color={color} transparent={opacity < 1} opacity={opacity} /></lineSegments>;
}

function WideSegments({ segments, color, yOffset, lineWidth, opacity, depthTest, renderOrder }: { segments: Segment[]; color: string; yOffset: number; lineWidth: number; opacity: number; depthTest: boolean; renderOrder: number }) {
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

function StructuralOverlay({ segments, style }: { segments: Segment[]; style: StructuralLineStyle }) {
  return <>
    <WideSegments segments={segments} color={style.color} yOffset={style.yOffset} lineWidth={style.lineWidth} opacity={style.xrayOpacity} depthTest={false} renderOrder={style.renderOrder} />
    <WideSegments segments={segments} color={style.color} yOffset={style.yOffset} lineWidth={style.lineWidth} opacity={style.opacity} depthTest renderOrder={style.renderOrder + 1} />
  </>;
}

function RouteLines({ lines, color, lineWidth, yOffset }: { lines: Point3[][]; color: string; lineWidth: number; yOffset: number }) {
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

function NetworkDirectionArrows({ arrows, color = '#fef08a', yOffset = 0.72, scale = 1 }: { arrows: NetworkDirectionArrow[]; color?: string; yOffset?: number; scale?: number }) {
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

function FacilityMarkerLayer({ candidates, floors, stacked, places, translations, enabledCategories, onRouteAction }: { candidates: FacilityMarkerCandidate[]; floors: string[]; stacked: boolean; places: NamedPlaceRecord[]; translations?: PlaceTranslationsDataset; enabledCategories: ReadonlySet<string>; onRouteAction: (place: NamedPlaceRecord, target: 'start' | 'destination') => void }) {
  const { locale, t } = useI18n();
  const camera = useThree((state) => state.camera);
  const initialZoom = 'zoom' in camera && typeof camera.zoom === 'number' ? camera.zoom : 1;
  const zoomRef = useRef(initialZoom);
  const [zoom, setZoom] = useState(initialZoom);
  const [selectedId, setSelectedId] = useState<string>();
  useFrame(() => {
    const nextZoom = 'zoom' in camera && typeof camera.zoom === 'number' ? Math.round(camera.zoom * 4) / 4 : 1;
    if (zoomRef.current !== nextZoom) {
      zoomRef.current = nextZoom;
      setZoom(nextZoom);
    }
  });
  const visible = useMemo(() => selectVisibleFacilityMarkers(candidates.filter((marker) => facilityMarkerMatchesPreferences(marker, enabledCategories)), floors, zoom), [candidates, enabledCategories, floors, zoom]);
  useEffect(() => {
    if (selectedId && !visible.some(({ id }) => id === selectedId)) setSelectedId(undefined);
  }, [selectedId, visible]);
  useEffect(() => {
    if (!selectedId) return;
    const dismiss = (event: PointerEvent) => {
      const owner = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-popup-owner]') : null;
      if (owner?.dataset.popupOwner !== selectedId) setSelectedId(undefined);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [selectedId]);
  return <>{visible.map((marker) => {
    const selected = marker.id === selectedId;
    const floorName = floorLongName(marker.floorId, locale);
    const categoryName = formatIndoorMapCategory('Facility', marker.categoryCode, locale);
    const place = routablePlaceForFacility(marker, places);
    const label = place ? publicPlaceName(place, locale, translations) : categoryName;
    const area = marker.sourceFacility ? publicAreaName(marker.sourceFacility, locale, translations) : t('place.unknownArea');
    const accessibleLabel = t('place.markerLabel', { label, floor: floorName, area });
    return <group key={marker.id} position={[marker.coordinates[0], displayElevation(marker.coordinates[1], stacked) + 2.35, marker.coordinates[2]]}>
      <Html center zIndexRange={[3, 0]} wrapperClass={selected ? 'map-html-layer map-popup-layer' : 'map-html-layer'}>
        <div className="source-facility-marker-wrap" data-popup-owner={marker.id}>
          <button type="button" className={`source-facility-marker source-facility-priority-${marker.priority}`} aria-label={accessibleLabel} aria-pressed={selected} title={accessibleLabel} onClick={() => setSelectedId(selected ? undefined : marker.id)}>{marker.icon}</button>
          {selected && <div className="source-facility-detail"><strong>{label}</strong><span>{floorName} · {area}</span>{place ? <span className="facility-route-actions"><button type="button" onClick={() => { onRouteAction(place, 'start'); setSelectedId(undefined); }}>{t('place.setStart')}</button><button type="button" onClick={() => { onRouteAction(place, 'destination'); setSelectedId(undefined); }}>{t('place.routeHere')}</button></span> : <span>{t('place.routingUnsupported')}</span>}</div>}
        </div>
      </Html>
    </group>;
  })}</>;
}

function PlaceLayer({ places, translations, startId, destinationId, debug, stacked, showGates, onRouteAction }: { places: NamedPlaceRecord[]; translations?: PlaceTranslationsDataset; startId: string; destinationId: string; debug: boolean; stacked: boolean; showGates: boolean; onRouteAction: (place: NamedPlaceRecord, target: 'start' | 'destination') => void }) {
  const { locale, t } = useI18n();
  const [selectedId, setSelectedId] = useState<string>();
  useEffect(() => {
    if (!selectedId) return;
    const dismiss = (event: PointerEvent) => {
      const owner = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-popup-owner]') : null;
      if (owner?.dataset.popupOwner !== selectedId) setSelectedId(undefined);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [selectedId]);
  return <>{places.filter((place) => (debug || place.routable) && placeHasPermanentLabel(place, startId, destinationId, showGates)).map((place) => {
    const start = place.id === startId; const destination = place.id === destinationId;
    const selected = place.id === selectedId;
    const color = start ? '#22c55e' : destination ? '#ef4444' : place.routable ? '#a78bfa' : '#f59e0b';
    const name = publicPlaceName(place, locale, translations);
    const area = publicAreaName(place.sourceFacility, locale, translations);
    const floorName = floorLongName(place.floorId, locale);
    return <group key={place.id} position={[place.coordinates[0], displayElevation(place.coordinates[1], stacked) + 3.55, place.coordinates[2]]}>
      <mesh><sphereGeometry args={[start || destination ? 1.2 : 0.72, 12, 12]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} /></mesh>
      {(start || destination) && <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.45, 1.8, 24]} /><meshBasicMaterial color={color} /></mesh>}
      <Html position={[start ? -2.5 : destination ? 2.5 : 0, 1.55, 0]} center zIndexRange={[4, 0]} wrapperClass={selected ? 'map-html-layer map-popup-layer' : 'map-html-layer'}><div className="place-label-wrap" data-popup-owner={place.id}>
        <button type="button" className={`place-label ${start ? 'place-label-start' : destination ? 'place-label-destination' : ''} ${place.routable ? '' : 'place-label-warning'}`} aria-pressed={selected} title={t('place.title', { name, area, distance: place.access.distanceMeters.toFixed(1) })} onClick={() => setSelectedId(selected ? undefined : place.id)}>{start ? `A · ${name}` : destination ? `B · ${name}` : name}</button>
        {selected && <div className="source-facility-detail place-label-detail"><strong>{name}</strong><span>{floorName} · {area}</span>{debug && <span title={place.id}>{place.name} · {place.sourceFacility}</span>}<span className="facility-route-actions"><button type="button" onClick={() => { onRouteAction(place, 'start'); setSelectedId(undefined); }}>{t('place.setStart')}</button><button type="button" onClick={() => { onRouteAction(place, 'destination'); setSelectedId(undefined); }}>{t('place.routeHere')}</button></span></div>}
      </div></Html>
    </group>;
  })}</>;
}

function highlightedPolylines(graph: RoutingGraph, edgeIds: string[], floors: string[], stacked: boolean): Point3[][] {
  if (edgeIds.length === 0) return [];
  const selected = new Set(edgeIds);
  return graph.edges.filter((edge) => selected.has(edge.id) && floors.includes(edge.floorFrom) && floors.includes(edge.floorTo)).map((edge) => edge.geometry.map((point) => displayPoint(point, stacked)));
}

export function MapScene(props: MapSceneProps) {
  const { locale, t } = useI18n();
  const stacked = props.visibleFloors.length > 1;
  const center = centerOf(props.floor);
  const { activeFloors, contextFloors } = useMemo(
    () => partitionVisibleFloors(props.visibleFloors, props.activeFloor, props.routeFloorIds, props.floorViewMode),
    [props.activeFloor, props.floorViewMode, props.routeFloorIds, props.visibleFloors],
  );
  const floorSegments = useMemo(() => featureSegments(props.floor.features, 'Floor', activeFloors, stacked), [activeFloors, props.floor, stacked]);
  const spaceSegments = useMemo(() => featureSegments(props.floor.features, 'Space', activeFloors, stacked), [activeFloors, props.floor, stacked]);
  const verticalSpaceSegments = useMemo(() => emphasizedSpaceSegments(props.floor.features, 'vertical', activeFloors, stacked), [activeFloors, props.floor.features, stacked]);
  const restrictedSpaceSegments = useMemo(() => emphasizedSpaceSegments(props.floor.features, 'restricted', activeFloors, stacked), [activeFloors, props.floor.features, stacked]);
  const openingSegments = useMemo(() => featureSegments(props.floor.features, 'Opening', activeFloors, stacked), [activeFloors, props.floor, stacked]);
  const contextFloorSegments = useMemo(() => featureSegments(props.floor.features, 'Floor', contextFloors, stacked), [contextFloors, props.floor, stacked]);
  const contextSpaceSegments = useMemo(() => featureSegments(props.floor.features, 'Space', contextFloors, stacked), [contextFloors, props.floor, stacked]);
  const contextOpeningSegments = useMemo(() => featureSegments(props.floor.features, 'Opening', contextFloors, stacked), [contextFloors, props.floor, stacked]);
  const floorEnvelopes = useMemo(() => wallEnvelopeSegments(props.floor.features, activeFloors, stacked), [activeFloors, props.floor, stacked]);
  const contextFloorEnvelopes = useMemo(() => wallEnvelopeSegments(props.floor.features, contextFloors, stacked), [contextFloors, props.floor, stacked]);
  const officialContextSegments = useMemo(() => graphContextSegments(props.routingGraph, props.visibleFloors, stacked), [props.routingGraph, props.visibleFloors, stacked]);
  const allSourceSegments = useMemo(() => allSourceLinkSegments(props.officialNetwork, props.visibleFloors, stacked), [props.officialNetwork, props.visibleFloors, stacked]);
  const officialDirectionArrows = useMemo(() => networkDirectionArrows(props.routingGraph.edges, props.visibleFloors, stacked), [props.routingGraph.edges, props.visibleFloors, stacked]);
  const twsiSegments = useMemo(() => graphSegments(props.twsiGraph, props.visibleFloors, stacked), [props.twsiGraph, props.visibleFloors, stacked]);
  const activeDrawingSegments = useMemo(() => featureSegments(props.floor.features, 'Drawing', activeFloors, stacked), [activeFloors, props.floor.features, stacked]);
  const contextDrawingSegments = useMemo(() => featureSegments(props.floor.features, 'Drawing', contextFloors, stacked), [contextFloors, props.floor.features, stacked]);
  const activeOutdoorSegments = useMemo(() => outdoorFeatureSegments(props.floor.features, activeFloors, stacked), [activeFloors, props.floor.features, stacked]);
  const contextOutdoorSegments = useMemo(() => outdoorFeatureSegments(props.floor.features, contextFloors, stacked), [contextFloors, props.floor.features, stacked]);
  const selectedRouteLines = useMemo(() => routePolylines(props.route, props.visibleFloors, stacked), [props.route, props.visibleFloors, stacked]);
  const verticalRouteLines = useMemo(() => routeTransitionPolylines(props.route, props.routingGraph, props.visibleFloors, stacked), [props.route, props.routingGraph, props.visibleFloors, stacked]);
  const routeDirectionArrows = useMemo(() => routeDirectionCues(props.route, props.routingGraph, props.visibleFloors, stacked), [props.route, props.routingGraph, props.visibleFloors, stacked]);
  const transitionMarkers = useMemo(() => routeTransitionMarkers(props.route, props.routingGraph, props.visibleFloors, stacked), [props.route, props.routingGraph, props.visibleFloors, stacked]);
  const highlightedRouteLines = useMemo(() => highlightedPolylines(props.routingGraph, props.highlightedRouteEdgeIds, props.visibleFloors, stacked), [props.highlightedRouteEdgeIds, props.routingGraph, props.visibleFloors, stacked]);
  return <group position={center}>
    <ambientLight intensity={0.85} />
    <hemisphereLight args={['#dbeafe', '#111827', 0.7]} />
    <directionalLight position={[80, 120, 80]} intensity={1.25} />
    <SemanticFixtureLayer features={props.floor.features} floors={contextFloors} stacked={stacked} context />
    <ExtrudedLayer features={props.floor.features} layer="Floor" floors={activeFloors} stacked={stacked} color="#172554" />
    <SemanticSpaceLayer features={props.floor.features} floors={activeFloors} stacked={stacked} />
    <SemanticFixtureLayer features={props.floor.features} floors={activeFloors} stacked={stacked} />
    <WideSegments segments={contextFloorSegments} color="#94a3b8" yOffset={0.32} lineWidth={1} opacity={0.12} depthTest={false} renderOrder={2000} />
    <WideSegments segments={contextFloorSegments} color="#94a3b8" yOffset={0.32} lineWidth={1.6} opacity={0.46} depthTest renderOrder={2001} />
    <Segments segments={contextFloorEnvelopes} color="#64748b" yOffset={0.32} opacity={0.18} />
    <Segments segments={contextSpaceSegments} color="#94a3b8" yOffset={0.44} opacity={0.32} />
    <StructuralOverlay segments={contextOpeningSegments} style={STRUCTURAL_LINE_STYLES.openingContext} />
    <WideSegments segments={floorSegments} color="#38bdf8" yOffset={0.32} lineWidth={1.2} opacity={0.16} depthTest={false} renderOrder={2010} />
    <WideSegments segments={floorSegments} color="#67e8f9" yOffset={0.32} lineWidth={2.4} opacity={0.9} depthTest renderOrder={2011} />
    <Segments segments={floorEnvelopes} color="#38bdf8" yOffset={0.32} opacity={0.42} />
    <Segments segments={spaceSegments} color="#bae6fd" yOffset={0.45} opacity={0.62} />
    <WideSegments segments={verticalSpaceSegments} color="#e0f2fe" yOffset={0.7} lineWidth={1.8} opacity={0.86} depthTest renderOrder={2020} />
    <WideSegments segments={restrictedSpaceSegments} color="#fb7185" yOffset={0.7} lineWidth={2.5} opacity={0.94} depthTest renderOrder={2021} />
    {props.showStructuralDetails && <>
      <StructuralOverlay segments={contextDrawingSegments} style={STRUCTURAL_LINE_STYLES.drawingContext} />
      <StructuralOverlay segments={activeDrawingSegments} style={STRUCTURAL_LINE_STYLES.drawingActive} />
    </>}
    <StructuralOverlay segments={contextOutdoorSegments} style={STRUCTURAL_LINE_STYLES.outdoorContext} />
    <StructuralOverlay segments={activeOutdoorSegments} style={STRUCTURAL_LINE_STYLES.outdoorActive} />
    <StructuralOverlay segments={openingSegments} style={STRUCTURAL_LINE_STYLES.openingActive} />
    {props.showOfficialNetwork && <>
      <WideSegments segments={officialContextSegments.inside} color="#38bdf8" yOffset={WALKING_NETWORK_HEIGHT} lineWidth={1.4} opacity={0.9} depthTest={false} renderOrder={3000} />
      <WideSegments segments={officialContextSegments.boundary} color="#f59e0b" yOffset={WALKING_NETWORK_HEIGHT + 0.03} lineWidth={1.4} opacity={0.9} depthTest={false} renderOrder={3001} />
      <WideSegments segments={officialContextSegments.outside} color="#c084fc" yOffset={WALKING_NETWORK_HEIGHT + 0.06} lineWidth={1.4} opacity={0.9} depthTest={false} renderOrder={3002} />
      <NetworkDirectionArrows arrows={officialDirectionArrows} yOffset={WALKING_NETWORK_ARROW_HEIGHT} />
    </>}
    {props.debug && props.showAllSourceLinks && <WideSegments segments={allSourceSegments} color="#22d3ee" yOffset={WALKING_NETWORK_HEIGHT + 0.08} lineWidth={1.2} opacity={0.72} depthTest={false} renderOrder={3009} />}
    {props.debug && props.showTwsi && <Segments segments={twsiSegments} color="#84cc16" yOffset={0.38} />}
    <RouteLines lines={selectedRouteLines} color="#fb923c" lineWidth={6} yOffset={3.9} />
    <RouteLines lines={verticalRouteLines} color="#22c55e" lineWidth={7} yOffset={4} />
    <NetworkDirectionArrows arrows={routeDirectionArrows} color="#fff7ed" yOffset={4.55} scale={0.82} />
    {transitionMarkers.map((marker) => <Html key={marker.edgeId} position={[marker.position[0], marker.position[1] + 4.7, marker.position[2]]} center zIndexRange={[5, 1]}><span className={`route-transition-marker transition-${marker.movement}`} title={t('instruction.transitionTitle', { movement: formatMovement(marker.movement, locale), fromFloor: floorDisplayName(marker.floorFrom, locale), toFloor: floorDisplayName(marker.floorTo, locale) })}>{marker.movement === 'elevator' ? 'EL' : marker.movement === 'escalator' ? 'ES' : marker.movement === 'stairs' ? 'ST' : '↕'} · {floorDisplayName(marker.floorFrom, locale)} → {floorDisplayName(marker.floorTo, locale)}</span></Html>)}
    <RouteLines lines={highlightedRouteLines} color="#fef08a" lineWidth={10} yOffset={4.12} />
    {props.debug && props.showOfficialNodes && props.routingGraph.nodes.filter((node) => props.visibleFloors.includes(node.floorId)).map((node) => <group key={node.id} position={[node.x, displayElevation(node.y, stacked) + 0.48, node.z]}><mesh><sphereGeometry args={[node.sourceId?.startsWith('reviewed:') ? 0.38 : 0.24, 8, 8]} /><meshStandardMaterial color={node.sourceId?.startsWith('reviewed:') ? '#f472b6' : '#bae6fd'} /></mesh><Html position={[0, 0.8, 0]} center zIndexRange={[3, 0]}><span className="node-label" title={node.id}>{node.sourceId?.startsWith('reviewed:') ? node.name : node.id.slice(0, 8)}</span></Html></group>)}
    {props.showFacilities && <FacilityMarkerLayer candidates={props.facilityMarkerCandidates} floors={props.visibleFloors} stacked={stacked} places={props.places} translations={props.translations} enabledCategories={props.enabledFacilityCategories} onRouteAction={props.onFacilityRouteAction} />}
    <PlaceLayer places={props.places.filter((place) => props.visibleFloors.includes(place.floorId))} translations={props.translations} startId={props.startId} destinationId={props.destinationId} debug={props.debug} stacked={stacked} showGates={props.showGateLabels} onRouteAction={props.onFacilityRouteAction} />
  </group>;
}
