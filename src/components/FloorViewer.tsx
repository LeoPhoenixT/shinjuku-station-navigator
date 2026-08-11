import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { TOUCH, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { floorElevationMeters } from '../data/floors.js';
import { useRoutePlanner } from '../features/route-planner/useRoutePlanner.js';
import { buildGraphFromProcessedData } from '../graph/buildGraph.js';
import { buildOfficialGraph } from '../graph/buildOfficialGraph.js';
import { mergeReviewedCustomGraph } from '../graph/buildReviewedCustomGraph.js';
import { useMapData } from '../hooks/useMapData.js';
import { GATE_CATEGORY_CODE, useMapDisplayPreferences } from '../hooks/useMapDisplayPreferences.js';
import { useMapInteractionMessage } from '../hooks/useMapInteractionMessage.js';
import { type CameraOrientation, useViewerNavigation } from '../hooks/useViewerNavigation.js';
import { ANGLED_CAMERA_POLAR_ANGLE, calculateAngledContentHeight, calculateCameraClearanceDistance, calculateOrthographicFitZoom } from '../map/cameraFit.js';
import type { MapBounds } from '../map/mapBounds.js';
import { MapScene } from '../map/MapScene.js';
import { MapTouchControls } from '../map/MapTouchControls.js';
import { buildFacilityMarkerCandidates } from '../map/facilityMarkers.js';
import { buildMapLegendItems } from '../map/mapLegend.js';
import { classifyNetworkEdgeContext } from '../map/networkContext.js';
import { RouteScreenOverlay } from '../map/RouteScreenOverlay.js';
import { displayElevation } from '../map/stackedElevation.js';
import { MAX_CAMERA_POLAR_ANGLE } from '../map/touchGestures.js';
import { publicPlaceName } from '../places/placePresentation.js';
import { ViewerControls } from './ViewerControls.js';
import { useI18n } from '../i18n/context.js';

const CAMERA_FAR_PADDING_METERS = 100;

function FitMapCamera({ bounds, datasetBounds, revision, stacked, orientation, zoomMultiplier }: { bounds: MapBounds; datasetBounds: MapBounds; revision: number; stacked: boolean; orientation: CameraOrientation; zoomMultiplier: number }) {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);

  useLayoutEffect(() => {
    if (!('isOrthographicCamera' in camera) || !camera.isOrthographicCamera) return;
    const contentWidth = bounds.maxX - bounds.minX;
    const contentDepth = bounds.maxZ - bounds.minZ;
    const contentHeight = displayElevation(bounds.maxY, stacked) - displayElevation(bounds.minY, stacked);
    const projectedContentHeight = orientation === 'angled'
      ? calculateAngledContentHeight(contentHeight, contentDepth, ANGLED_CAMERA_POLAR_ANGLE)
      : contentDepth;
    const fittedZoom = calculateOrthographicFitZoom(size.width, size.height, contentWidth, projectedContentHeight);
    camera.zoom = Math.min(24, Math.max(0.2, fittedZoom * zoomMultiplier));

    const centerX = (bounds.minX + bounds.maxX - datasetBounds.minX - datasetBounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ - datasetBounds.minZ - datasetBounds.maxZ) / 2;
    const centerY = displayElevation((bounds.minY + bounds.maxY) / 2, stacked);
    const datasetWidth = datasetBounds.maxX - datasetBounds.minX;
    const datasetDepth = datasetBounds.maxZ - datasetBounds.minZ;
    const datasetHeight = displayElevation(datasetBounds.maxY, stacked) - displayElevation(datasetBounds.minY, stacked);
    const datasetDiagonal = Math.hypot(datasetWidth, datasetHeight, datasetDepth);
    const cameraDistance = calculateCameraClearanceDistance(datasetWidth, datasetHeight, datasetDepth);
    const verticalOffset = orientation === 'angled'
      ? cameraDistance * Math.cos(ANGLED_CAMERA_POLAR_ANGLE)
      : cameraDistance;
    const depthOffset = orientation === 'angled'
      ? cameraDistance * Math.sin(ANGLED_CAMERA_POLAR_ANGLE)
      : 0.01;

    camera.position.set(centerX, centerY + verticalOffset, centerZ + depthOffset);
    camera.near = 0.1;
    camera.far = Math.max(1500, cameraDistance + datasetDiagonal + CAMERA_FAR_PADDING_METERS);
    camera.lookAt(centerX, centerY, centerZ);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    invalidate();
  }, [bounds, camera, datasetBounds, invalidate, orientation, revision, size.height, size.width, stacked, zoomMultiplier]);

  return null;
}

function CameraHeadingReporter({ onHeadingChange }: { onHeadingChange: (degrees: number) => void }) {
  const camera = useThree((state) => state.camera);
  const direction = useRef(new Vector3());
  const previous = useRef(Number.NaN);
  useFrame(() => {
    camera.getWorldDirection(direction.current);
    const degrees = Math.round((Math.atan2(-direction.current.x, -direction.current.z) * 180 / Math.PI + 360) % 360);
    if (degrees !== previous.current) {
      previous.current = degrees;
      onHeadingChange(degrees);
    }
  });
  return null;
}

function ReadyViewer({ data }: { data: Extract<ReturnType<typeof useMapData>, { status: 'ready' }>['data'] }) {
  const { locale, t } = useI18n();
  const floorIds = useMemo(() => [...new Set(data.floor.features.map(({ floorId }) => floorId).filter((floorId): floorId is string => Boolean(floorId)))].sort((a, b) => floorElevationMeters(a) - floorElevationMeters(b)), [data.floor.features]);
  const allFloorIds = useMemo(() => [...new Set([...floorIds, ...data.network.selection.floorIds])].sort((a, b) => floorElevationMeters(a) - floorElevationMeters(b)), [data.network.selection.floorIds, floorIds]);
  const routingGraph = useMemo(() => mergeReviewedCustomGraph(buildOfficialGraph(data.network), data.reviewedNetwork), [data.network, data.reviewedNetwork]);
  const twsiGraph = useMemo(() => buildGraphFromProcessedData(data.floor), [data.floor]);
  const facilityMarkerCandidates = useMemo(() => buildFacilityMarkerCandidates(data.floor.features, routingGraph.nodes.map((node) => ({ id: node.id, floorId: node.floorId, x: node.x, z: node.z }))), [data.floor.features, routingGraph.nodes]);
  const planner = useRoutePlanner(data.network, routingGraph, data.places.places);
  const initialDestinationFloor = data.places.places.find(({ id }) => id === planner.destinationId)?.floorId;
  const {
    interactionMessage,
    setInteractionMessage,
    clearInteractionMessage,
  } = useMapInteractionMessage();
  const display = useMapDisplayPreferences(
    facilityMarkerCandidates,
    data.places.places.filter(({ category, routable }) => category === 'gate' && routable).length,
  );
  const navigation = useViewerNavigation({
    floor: data.floor,
    graph: routingGraph,
    route: planner.route,
    floorIds,
    allFloorIds,
    initialDestinationFloor,
    notify: setInteractionMessage,
  });
  const {
    debug,
    setDebug,
    showAllSourceLinks,
    setShowAllSourceLinks,
    showOfficialNetwork,
    setShowOfficialNetwork,
    showOfficialNodes,
    setShowOfficialNodes,
    showTwsi,
    setShowTwsi,
    showFacilities,
    setShowFacilities,
    showStructuralDetails,
    setShowStructuralDetails,
    enabledFacilityCategories,
    filteredFacilityCandidates,
    facilityCategories,
    toggleFacilityCategory,
    showAllFacilityCategories,
    clearAllFacilityCategories,
    resetFacilityCategories,
  } = display;
  const {
    activeFloor,
    visibleFloors,
    floorViewMode,
    rotationEnabled,
    setRotationEnabled,
    cameraHeading,
    setCameraHeading,
    cameraRevision,
    cameraOrientation,
    zoomMultiplier,
    selectedStepIndex,
    stackedFloors,
    routeFloorIds,
    cameraBounds,
    cameraCenter,
    highlightedEdgeIds,
    fitRoute,
    fitStation,
    selectFloor,
    showStack,
    toggleCustomFloor,
    showRouteFloors,
    selectStep,
    resetAfterRouteClear,
    zoomIn,
    zoomOut,
    showNorthView,
    showAngledView,
  } = navigation;
  const routeHaloPathRef = useRef<SVGPathElement>(null);
  const routePathRef = useRef<SVGPathElement>(null);
  const transitionHaloPathRef = useRef<SVGPathElement>(null);
  const transitionPathRef = useRef<SVGPathElement>(null);
  const orbitControlsRef = useRef<OrbitControlsImpl>(null);
  const visibleNetworkState = useMemo(() => {
    const nodes = new Map(routingGraph.nodes.map((node) => [node.id, node]));
    const edges = routingGraph.edges.filter((edge) => visibleFloors.includes(edge.floorFrom) && visibleFloors.includes(edge.floorTo));
    return { contexts: [...new Set(edges.map((edge) => classifyNetworkEdgeContext(edge, nodes)))], hasOneWay: edges.some(({ direction }) => direction !== 'both') };
  }, [routingGraph.edges, routingGraph.nodes, visibleFloors]);
  const legendItems = useMemo(() => buildMapLegendItems({
    features: data.floor.features, facilityCandidates: filteredFacilityCandidates, places: data.places.places, visibleFloors, route: planner.route,
    startId: planner.startId, destinationId: planner.destinationId, showFacilities, showStructuralDetails, showOfficialNetwork, networkContexts: visibleNetworkState.contexts, hasOneWayNetwork: visibleNetworkState.hasOneWay, debug, showAllSourceLinks, showTwsi,
    locale,
  }), [data.floor.features, data.places.places, debug, filteredFacilityCandidates, locale, planner.destinationId, planner.route, planner.startId, showAllSourceLinks, showFacilities, showOfficialNetwork, showStructuralDetails, showTwsi, visibleFloors, visibleNetworkState]);

  const selectPlannerPlace = (id: string, target: 'start' | 'destination') => {
    if (target === 'start') planner.setStartId(id); else planner.setDestinationId(id);
    clearInteractionMessage();
  };
  const selectFacilityRouteAction = (place: (typeof data.places.places)[number], target: 'start' | 'destination') => {
    if (target === 'start') {
      planner.setStartId(place.id);
      setInteractionMessage(t('feedback.startSet', { place: publicPlaceName(place, locale, data.translations) }));
      return;
    }
    if (!planner.startId) {
      planner.setDestinationId(place.id);
      setInteractionMessage(t('feedback.destinationNeedsStart', { place: publicPlaceName(place, locale, data.translations) }));
      return;
    }
    planner.routeToDestination(place.id);
    setInteractionMessage(t('feedback.showingRoute', { place: publicPlaceName(place, locale, data.translations) }));
  };
  return <div className="floor-viewer">
    <Canvas frameloop="demand" orthographic camera={{ position: [0, 120, 0.01], zoom: 1, near: 0.1, far: 3000 }} aria-label={t('app.viewerLabel')}>
      <color attach="background" args={["#08111f"]} />
      <FitMapCamera bounds={cameraBounds} datasetBounds={data.floor.statistics.bounds} revision={cameraRevision} stacked={stackedFloors} orientation={cameraOrientation} zoomMultiplier={zoomMultiplier} />
      <CameraHeadingReporter onHeadingChange={setCameraHeading} />
      <MapScene activeFloor={activeFloor} floorViewMode={floorViewMode} routeFloorIds={routeFloorIds} visibleFloors={visibleFloors} floor={data.floor} officialNetwork={data.network} routingGraph={routingGraph} twsiGraph={twsiGraph} places={data.places.places} translations={data.translations} facilityMarkerCandidates={facilityMarkerCandidates} route={planner.route} startId={planner.startId} destinationId={planner.destinationId} highlightedRouteEdgeIds={highlightedEdgeIds} debug={debug} showAllSourceLinks={showAllSourceLinks} showOfficialNetwork={showOfficialNetwork} showOfficialNodes={showOfficialNodes} showTwsi={showTwsi} showFacilities={showFacilities} enabledFacilityCategories={enabledFacilityCategories} showGateLabels={showFacilities && enabledFacilityCategories.has(GATE_CATEGORY_CODE)} showStructuralDetails={showStructuralDetails} onFacilityRouteAction={selectFacilityRouteAction} />
      <RouteScreenOverlay route={planner.route} visibleFloors={visibleFloors} floor={data.floor} routingGraph={routingGraph} haloPathRef={routeHaloPathRef} routePathRef={routePathRef} transitionHaloPathRef={transitionHaloPathRef} transitionPathRef={transitionPathRef} />
      <OrbitControls ref={orbitControlsRef} key={`${cameraRevision}:${visibleFloors.join(',')}:${activeFloor}`} makeDefault target={[cameraCenter.x, cameraCenter.y, cameraCenter.z]} enableRotate={rotationEnabled} zoomSpeed={0.55} minZoom={0.2} maxZoom={24} maxPolarAngle={MAX_CAMERA_POLAR_ANGLE} touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }} />
      <MapTouchControls controlsRef={orbitControlsRef} rotationEnabled={rotationEnabled} />
    </Canvas>
    <svg className="route-screen-overlay" aria-hidden="true"><path ref={routeHaloPathRef} className="route-screen-halo" /><path ref={transitionHaloPathRef} className="route-screen-transition-halo" /><path ref={routePathRef} className="route-screen-line" /><path ref={transitionPathRef} className="route-screen-transition-line" /></svg>
    <ViewerControls
      floorIds={floorIds} visibleFloors={visibleFloors} routeFloorIds={routeFloorIds} activeFloor={activeFloor} floorViewMode={floorViewMode} selectFloor={selectFloor} showStack={showStack} showRouteFloors={showRouteFloors} toggleCustomFloor={toggleCustomFloor}
      debug={debug} setDebug={setDebug} showAllSourceLinks={showAllSourceLinks} setShowAllSourceLinks={setShowAllSourceLinks} places={data.places.places} translations={data.translations} startId={planner.startId} destinationId={planner.destinationId}
      setStartId={(id) => selectPlannerPlace(id, 'start')} setDestinationId={(id) => selectPlannerPlace(id, 'destination')}
      swapPlaces={() => { const start = planner.startId; planner.setStartId(planner.destinationId); planner.setDestinationId(start); setInteractionMessage(t('feedback.swapped')); }}
      clearRoute={() => { planner.clearRoute(); resetAfterRouteClear(); setInteractionMessage(t('feedback.cleared')); }}
      route={planner.route} profile={planner.profile} setProfile={planner.setProfile} routeDirty={planner.routeDirty} submitRoute={planner.submitRoute}
      showOfficialNetwork={showOfficialNetwork} setShowOfficialNetwork={setShowOfficialNetwork} showOfficialNodes={showOfficialNodes} setShowOfficialNodes={setShowOfficialNodes}
      showTwsi={showTwsi} setShowTwsi={setShowTwsi}
      showFacilities={showFacilities} setShowFacilities={setShowFacilities} facilityCategories={facilityCategories} enabledFacilityCategories={enabledFacilityCategories}
      toggleFacilityCategory={toggleFacilityCategory}
      showAllFacilityCategories={showAllFacilityCategories} clearAllFacilityCategories={clearAllFacilityCategories} resetFacilityCategories={resetFacilityCategories}
      showStructuralDetails={showStructuralDetails} setShowStructuralDetails={setShowStructuralDetails}
      rotationEnabled={rotationEnabled} setRotationEnabled={setRotationEnabled}
      fitRoute={fitRoute} fitStation={fitStation} zoomIn={zoomIn} zoomOut={zoomOut}
      showNorthView={showNorthView} showAngledView={showAngledView}
      cameraHeading={cameraHeading}
      selectedStepIndex={selectedStepIndex} onStepSelect={selectStep} interactionMessage={interactionMessage}
      legendItems={legendItems}
    />
  </div>;
}

export function FloorViewer() {
  const { t } = useI18n();
  const state = useMapData();
  if (state.status === 'error') return <div role="alert" className="viewer-status">{t('app.dataLoadFailure', { message: state.message || t('app.unknownLoadError') })}</div>;
  if (state.status === 'loading') return <div className="viewer-status">{t('app.loadingData')}</div>;
  return <ReadyViewer data={state.data} />;
}
