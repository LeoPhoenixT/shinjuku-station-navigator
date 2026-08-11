import { useEffect, useMemo, useState } from 'react';
import type { RoutingGraph } from '../graph/types.js';
import { boundsForFloors, boundsForRoute, boundsForRouteStep } from '../map/mapBounds.js';
import type { FloorViewMode } from '../map/displayPreferences.js';
import { displayElevation } from '../map/stackedElevation.js';
import { DEFAULT_ROTATION_ENABLED, DEFAULT_STACKED_FLOORS } from '../map/viewerPresentation.js';
import type { RoutePlan } from '../routing/routeService.js';
import type { ProcessedDataset } from '../types/processed.js';
import { useI18n } from '../i18n/context.js';

export type CameraOrientation = 'angled' | 'north';
export type CameraMode = 'route' | 'station' | 'step';

interface ViewerNavigationInput {
  floor: ProcessedDataset;
  graph: RoutingGraph;
  route: RoutePlan;
  floorIds: string[];
  allFloorIds: string[];
  initialDestinationFloor?: string;
  notify: (message: string) => void;
}

export function useViewerNavigation({
  floor,
  graph,
  route,
  floorIds,
  allFloorIds,
  initialDestinationFloor,
  notify,
}: ViewerNavigationInput) {
  const { t } = useI18n();
  const initialFloor = initialDestinationFloor && floorIds.includes(initialDestinationFloor)
    ? initialDestinationFloor
    : floorIds.includes('B1') ? 'B1' : floorIds[0];
  const [activeFloor, setActiveFloor] = useState(initialFloor);
  const [visibleFloors, setVisibleFloors] = useState<string[]>(() => (
    DEFAULT_STACKED_FLOORS
      ? allFloorIds
      : [initialDestinationFloor && allFloorIds.includes(initialDestinationFloor) ? initialDestinationFloor : allFloorIds[0]]
  ));
  const [floorViewMode, setFloorViewMode] = useState<FloorViewMode>(DEFAULT_STACKED_FLOORS ? 'stack' : 'focused');
  const [rotationEnabled, setRotationEnabled] = useState(DEFAULT_ROTATION_ENABLED);
  const [cameraHeading, setCameraHeading] = useState(0);
  const [cameraRevision, setCameraRevision] = useState(0);
  const [cameraMode, setCameraMode] = useState<CameraMode>('route');
  const [cameraOrientation, setCameraOrientation] = useState<CameraOrientation>('angled');
  const [zoomMultiplier, setZoomMultiplier] = useState(1);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>();
  const stackedFloors = visibleFloors.length > 1;
  const routeFloorIds = useMemo(() => {
    if (route.status !== 'ok') return [];
    const nodeFloors = new Map(graph.nodes.map((node) => [node.id, node.floorId]));
    const selected = new Set(
      route.network.nodeIds
        .map((nodeId) => nodeFloors.get(nodeId))
        .filter((floorId): floorId is string => Boolean(floorId)),
    );
    return allFloorIds.filter((floorId) => selected.has(floorId));
  }, [allFloorIds, graph.nodes, route]);
  const visibleBounds = useMemo(
    () => boundsForFloors(floor, visibleFloors),
    [floor, visibleFloors],
  );
  const routeBounds = useMemo(
    () => boundsForRoute(route, visibleBounds),
    [route, visibleBounds],
  );
  const stepBounds = useMemo(
    () => boundsForRouteStep(route, graph, selectedStepIndex, routeBounds),
    [graph, route, routeBounds, selectedStepIndex],
  );
  const cameraBounds = cameraMode === 'station'
    ? visibleBounds
    : cameraMode === 'step' && stepBounds ? stepBounds : routeBounds;
  const cameraCenter = useMemo(() => ({
    x: (cameraBounds.minX + cameraBounds.maxX - floor.statistics.bounds.minX - floor.statistics.bounds.maxX) / 2,
    y: displayElevation((cameraBounds.minY + cameraBounds.maxY) / 2, stackedFloors),
    z: (cameraBounds.minZ + cameraBounds.maxZ - floor.statistics.bounds.minZ - floor.statistics.bounds.maxZ) / 2,
  }), [cameraBounds, floor.statistics.bounds, stackedFloors]);
  const highlightedEdgeIds = route.status === 'ok' && selectedStepIndex !== undefined
    ? route.steps[selectedStepIndex]?.edgeIds ?? []
    : [];

  const reviseCamera = () => setCameraRevision((value) => value + 1);

  useEffect(() => {
    setCameraMode(route.status === 'ok' ? 'route' : 'station');
    setSelectedStepIndex(undefined);
    setZoomMultiplier(1);
    reviseCamera();
  }, [route]);

  const fitRoute = () => {
    setCameraMode(route.status === 'ok' ? 'route' : 'station');
    setSelectedStepIndex(undefined);
    setZoomMultiplier(1);
    reviseCamera();
  };

  const fitStation = () => {
    setCameraMode('station');
    setSelectedStepIndex(undefined);
    setZoomMultiplier(1);
    reviseCamera();
  };

  const selectFloor = (floorId: string) => {
    if (!allFloorIds.includes(floorId)) return;
    setVisibleFloors(allFloorIds);
    setActiveFloor(floorId);
    setFloorViewMode('focused');
    setCameraMode('station');
    setCameraOrientation(allFloorIds.length > 1 ? 'angled' : 'north');
    setSelectedStepIndex(undefined);
    setZoomMultiplier(1);
    reviseCamera();
  };

  const showStack = () => {
    setVisibleFloors(allFloorIds);
    setFloorViewMode('stack');
    setCameraMode(route.status === 'ok' ? 'route' : 'station');
    setCameraOrientation('angled');
    setSelectedStepIndex(undefined);
    setZoomMultiplier(1);
    reviseCamera();
  };

  const toggleCustomFloor = (floorId: string) => {
    if (!allFloorIds.includes(floorId)) return;
    const nextFloors = visibleFloors.includes(floorId)
      ? visibleFloors.filter((visibleFloor) => visibleFloor !== floorId)
      : allFloorIds.filter((candidate) => visibleFloors.includes(candidate) || candidate === floorId);
    if (nextFloors.length === 0) {
      notify(t('feedback.keepOneFloor'));
      return;
    }
    setVisibleFloors(nextFloors);
    setActiveFloor(nextFloors.includes(activeFloor) ? activeFloor : nextFloors[0]);
    setFloorViewMode('custom');
    setCameraMode('station');
    setCameraOrientation(nextFloors.length > 1 ? 'angled' : 'north');
    setSelectedStepIndex(undefined);
    setZoomMultiplier(1);
    reviseCamera();
  };

  const showRouteFloors = () => {
    if (routeFloorIds.length === 0) return;
    const preferredActiveFloor = routeFloorIds.find((floorId) => floorIds.includes(floorId)) ?? routeFloorIds[0];
    setVisibleFloors(allFloorIds);
    setFloorViewMode('route');
    setActiveFloor((current) => (
      routeFloorIds.includes(current) && floorIds.includes(current) ? current : preferredActiveFloor
    ));
    setCameraMode('route');
    setCameraOrientation(allFloorIds.length > 1 ? 'angled' : 'north');
    setSelectedStepIndex(undefined);
    setZoomMultiplier(1);
    reviseCamera();
  };

  const selectStep = (index: number) => {
    if (route.status !== 'ok' || !route.steps[index]) return;
    setSelectedStepIndex(index);
    const floorId = route.steps[index].floorTo;
    setActiveFloor(floorId);
    setVisibleFloors((current) => (
      current.includes(floorId)
        ? current
        : allFloorIds.filter((candidate) => current.includes(candidate) || candidate === floorId)
    ));
    setCameraMode('step');
    setZoomMultiplier(1);
    reviseCamera();
  };

  const resetAfterRouteClear = () => {
    setSelectedStepIndex(undefined);
    setCameraMode('station');
  };

  return {
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
    zoomIn: () => setZoomMultiplier((value) => Math.min(4, value * 1.25)),
    zoomOut: () => setZoomMultiplier((value) => Math.max(0.5, value / 1.25)),
    showNorthView: () => {
      setCameraOrientation('north');
      reviseCamera();
    },
    showAngledView: () => {
      setCameraOrientation('angled');
      reviseCamera();
    },
  };
}
