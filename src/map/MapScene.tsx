import { Html } from '@react-three/drei';
import { useMemo } from 'react';
import type { RoutingGraph } from '../graph/types.js';
import type { RoutePlan } from '../routing/routeService.js';
import type { NamedPlaceRecord } from '../schema/processed.js';
import type { OfficialNetworkDataset } from '../types/officialNetwork.js';
import type { ProcessedDataset } from '../types/processed.js';
import { floorDisplayName } from '../places/placePresentation.js';
import type { PlaceTranslationsDataset } from '../schema/placeTranslations.js';
import { useI18n } from '../i18n/context.js';
import { formatMovement } from '../i18n/formatters.js';
import { displayElevation } from './stackedElevation.js';
import { wallEnvelopeSegments } from './wallEnvelope.js';
import { routeDirectionCues, routePolylines, routeTransitionMarkers, routeTransitionPolylines } from './routeLineGeometry.js';
import { networkDirectionArrows } from './networkDirectionGeometry.js';
import { STRUCTURAL_LINE_STYLES } from './structuralLinePresentation.js';
import type { FacilityMarkerCandidate } from './facilityMarkers.js';
import type { FloorViewMode } from './displayPreferences.js';
import { allSourceLinkSegments } from './debugNetwork.js';
import { partitionVisibleFloors } from './viewerPresentation.js';
import { emphasizedSpaceSegments, featureSegments, graphContextSegments, graphSegments, highlightedPolylines, outdoorFeatureSegments, sceneCenter } from './sceneGeometry.js';
import { ExtrudedLayer, SemanticFixtureLayer, SemanticSpaceLayer } from './sceneLayers.js';
import { NetworkDirectionArrows, RouteLines, Segments, StructuralOverlay, WideSegments } from './sceneLinePrimitives.js';
import { FacilityMarkerLayer, PlaceLayer } from './sceneMarkerLayers.js';

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

const WALKING_NETWORK_HEIGHT = 1.15;
const WALKING_NETWORK_ARROW_HEIGHT = 1.55;

export function MapScene(props: MapSceneProps) {
  const { locale, t } = useI18n();
  const stacked = props.visibleFloors.length > 1;
  const center = sceneCenter(props.floor);
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
