import type { RoutingGraph } from '../graph/types.js';
import type { RoutePlan } from '../routing/routeService.js';
import type { ProcessedDataset } from '../types/processed.js';

export type MapBounds = ProcessedDataset['statistics']['bounds'];
type Point3 = [number, number, number];

function fromPoints(points: Point3[], fallback: MapBounds): MapBounds {
  if (points.length === 0) return fallback;
  return points.reduce<MapBounds>((bounds, [x, y, z]) => ({
    minX: Math.min(bounds.minX, x), minY: Math.min(bounds.minY, y), minZ: Math.min(bounds.minZ, z),
    maxX: Math.max(bounds.maxX, x), maxY: Math.max(bounds.maxY, y), maxZ: Math.max(bounds.maxZ, z),
  }), { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity });
}

export function expandMapBounds(bounds: MapBounds, horizontalPaddingMeters: number): MapBounds {
  return {
    minX: bounds.minX - horizontalPaddingMeters,
    minY: bounds.minY,
    minZ: bounds.minZ - horizontalPaddingMeters,
    maxX: bounds.maxX + horizontalPaddingMeters,
    maxY: bounds.maxY,
    maxZ: bounds.maxZ + horizontalPaddingMeters,
  };
}

export function boundsForFloors(dataset: ProcessedDataset, floorIds: string[]): MapBounds {
  const points = dataset.features
    .filter((feature) => floorIds.includes(feature.floorId ?? 'B1'))
    .flatMap((feature) => feature.geometry.type === 'Point' ? [feature.geometry.coordinates] : feature.geometry.parts.flat());
  return fromPoints(points, dataset.statistics.bounds);
}

export function boundsForRoute(route: RoutePlan, fallback: MapBounds): MapBounds {
  if (route.status !== 'ok') return fallback;
  return expandMapBounds(fromPoints(route.legs.flatMap((leg) => leg.geometry), fallback), 18);
}

export function boundsForRouteStep(route: RoutePlan, graph: RoutingGraph, stepIndex: number | undefined, fallback: MapBounds): MapBounds | undefined {
  if (route.status !== 'ok' || stepIndex === undefined) return undefined;
  const step = route.steps[stepIndex];
  if (!step) return undefined;
  let points: Point3[] = [];
  if (step.edgeIds.length > 0) {
    const edgeIds = new Set(step.edgeIds);
    points = graph.edges.filter((edge) => edgeIds.has(edge.id)).flatMap((edge) => edge.geometry);
  } else if (step.kind === 'access') {
    points = route.start.access.geometry;
  } else if (step.kind === 'arrive') {
    points = route.destination.access.geometry;
  }
  return points.length > 0 ? expandMapBounds(fromPoints(points, fallback), 10) : undefined;
}
