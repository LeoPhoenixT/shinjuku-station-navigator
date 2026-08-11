import type { NamedPlaceRecord, OfficialNetworkDataset } from '../schema/processed.js';
import type { RoutingGraph } from '../graph/types.js';
import { astar, type RouteResult, type RoutingProfile } from './pathfinding.js';
import { buildRouteInstructions, type RouteStep } from './routeInstructions.js';

export type RouteWarning =
  | { code: 'accessibility-fields-unknown'; fields: string[] }
  | { code: 'accessibility-access-unverified'; placeIds: string[] };

export type RoutePlan =
  | { status: 'ok'; start: NamedPlaceRecord; destination: NamedPlaceRecord; profile: RoutingProfile; warnings: RouteWarning[]; steps: RouteStep[]; network: RouteResult; accessDistanceMeters: number; totalDistanceMeters: number; legs: Array<{ kind: 'start-access' | 'network' | 'destination-access'; geometry: Array<[number, number, number]> }> }
  | { status: 'invalid-place'; placeId: string; reason: 'not-found' | 'low-confidence-attachment' }
  | { status: 'outside-coverage'; start: NamedPlaceRecord; destination: NamedPlaceRecord; reason: 'different-components-in-bounded-extraction' }
  | { status: 'unreachable'; start: NamedPlaceRecord; destination: NamedPlaceRecord; reason: 'no-directed-path' | 'no-accessible-path' | 'no-stair-free-path' };

function traversedGeometry(graph: RoutingGraph, route: RouteResult): Array<[number, number, number]> {
  const result: Array<[number, number, number]> = [];
  for (let index = 0; index < route.edgeIds.length; index += 1) {
    const from = route.nodeIds[index];
    const edgeId = route.edgeIds[index];
    const edge = graph.adjacency[from]?.find((candidate) => candidate.id.replace(/:reverse$/, '') === edgeId);
    if (!edge) throw new Error(`Route edge ${edgeId} is missing from adjacency at ${from}.`);
    result.push(...(result.length === 0 ? edge.geometry : edge.geometry.slice(1)));
  }
  return result;
}

function routeWarnings(graph: RoutingGraph, route: RouteResult, profile: RoutingProfile, start: NamedPlaceRecord, destination: NamedPlaceRecord): RouteWarning[] {
  if (profile !== 'accessible') return [];
  const unknownFields = new Set<string>();
  for (const edgeId of route.edgeIds) graph.edges.find(({ id }) => id === edgeId)?.accessibilityUnknowns?.forEach((field) => unknownFields.add(field));
  const warnings: RouteWarning[] = unknownFields.size === 0 ? [] : [{ code: 'accessibility-fields-unknown', fields: [...unknownFields].sort() }];
  const unknownAccess = [start, destination].filter(({ access }) => access.accessibility === 'unknown').map(({ id }) => id);
  if (unknownAccess.length > 0) warnings.push({ code: 'accessibility-access-unverified', placeIds: unknownAccess });
  return warnings;
}

export function planRoute(network: OfficialNetworkDataset, graph: RoutingGraph, places: NamedPlaceRecord[], startId: string, destinationId: string, profile: RoutingProfile = 'shortest'): RoutePlan {
  const start = places.find(({ id }) => id === startId);
  const destination = places.find(({ id }) => id === destinationId);
  if (!start) return { status: 'invalid-place', placeId: startId, reason: 'not-found' };
  if (!destination) return { status: 'invalid-place', placeId: destinationId, reason: 'not-found' };
  if (!start.routable) return { status: 'invalid-place', placeId: start.id, reason: 'low-confidence-attachment' };
  if (!destination.routable) return { status: 'invalid-place', placeId: destination.id, reason: 'low-confidence-attachment' };
  if (profile === 'accessible' && (start.access.accessibility === 'no' || destination.access.accessibility === 'no')) {
    return { status: 'unreachable', start, destination, reason: 'no-accessible-path' };
  }
  if (start.id === destination.id) {
    const networkRoute: RouteResult = { nodeIds: [start.access.nodeId], edgeIds: [], distanceMeters: 0, totalCost: 0 };
    return {
      status: 'ok',
      start,
      destination,
      profile,
      warnings: [],
      steps: [{ kind: 'arrive', distanceMeters: 0, floorFrom: destination.floorId, floorTo: destination.floorId, edgeIds: [], alreadyThere: true }],
      network: networkRoute,
      accessDistanceMeters: 0,
      totalDistanceMeters: 0,
      legs: [],
    };
  }
  if (start.access.componentId !== destination.access.componentId && network.selection.coverage === 'bounded-extraction') {
    return { status: 'outside-coverage', start, destination, reason: 'different-components-in-bounded-extraction' };
  }
  const route = astar(graph, start.access.nodeId, destination.access.nodeId, { profile });
  if (!route) return { status: 'unreachable', start, destination, reason: profile === 'accessible' ? 'no-accessible-path' : profile === 'avoid-stairs' ? 'no-stair-free-path' : 'no-directed-path' };
  const accessDistanceMeters = Number((start.access.distanceMeters + destination.access.distanceMeters).toFixed(3));
  return {
    status: 'ok',
    start,
    destination,
    profile,
    warnings: routeWarnings(graph, route, profile, start, destination),
    steps: buildRouteInstructions(graph, route, start, destination),
    network: route,
    accessDistanceMeters,
    totalDistanceMeters: Number((route.distanceMeters + accessDistanceMeters).toFixed(3)),
    legs: [
      { kind: 'start-access', geometry: start.access.geometry },
      { kind: 'network', geometry: traversedGeometry(graph, route) },
      { kind: 'destination-access', geometry: [...destination.access.geometry].reverse() },
    ],
  };
}
