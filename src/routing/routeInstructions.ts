import type { GraphEdge, RoutingGraph } from '../graph/types.js';
import type { NamedPlaceRecord } from '../schema/processed.js';
import type { RouteResult } from './pathfinding.js';

export const STRAIGHT_ANGLE_THRESHOLD_DEGREES = 20;

export interface RouteStep {
  kind: 'access' | 'continue' | 'turn-left' | 'turn-right' | 'transition' | 'arrive';
  distanceMeters: number;
  floorFrom: string;
  floorTo: string;
  movement?: GraphEdge['kind'];
  edgeIds: string[];
  alreadyThere?: boolean;
}

function routeEdges(graph: RoutingGraph, route: RouteResult): GraphEdge[] {
  return route.edgeIds.map((edgeId, index) => {
    const edge = graph.adjacency[route.nodeIds[index]]?.find((candidate) => candidate.id.replace(/:reverse$/, '') === edgeId);
    if (!edge) throw new Error(`Route edge ${edgeId} is missing from adjacency at ${route.nodeIds[index]}.`);
    return edge;
  });
}

function heading(edge: GraphEdge): number {
  const start = edge.geometry[0];
  const end = edge.geometry.at(-1) ?? start;
  return Math.atan2(end[2] - start[2], end[0] - start[0]);
}

function signedTurnDegrees(from: GraphEdge, to: GraphEdge): number {
  let difference = (heading(to) - heading(from)) * 180 / Math.PI;
  while (difference > 180) difference -= 360;
  while (difference <= -180) difference += 360;
  return difference;
}

interface EdgeGroup { edges: GraphEdge[]; turnDegrees?: number }

function groupEdges(edges: GraphEdge[]): EdgeGroup[] {
  const groups: EdgeGroup[] = [];
  for (const edge of edges) {
    const previousGroup = groups.at(-1);
    const previousEdge = previousGroup?.edges.at(-1);
    const transition = edge.floorFrom !== edge.floorTo;
    const canCombine = previousGroup && previousEdge && !transition && previousEdge.floorFrom === previousEdge.floorTo && previousEdge.floorTo === edge.floorFrom && previousEdge.kind === edge.kind && Math.abs(signedTurnDegrees(previousEdge, edge)) <= STRAIGHT_ANGLE_THRESHOLD_DEGREES;
    if (canCombine) previousGroup.edges.push(edge);
    else groups.push({ edges: [edge], turnDegrees: previousEdge && previousEdge.floorFrom === previousEdge.floorTo && !transition ? signedTurnDegrees(previousEdge, edge) : undefined });
  }
  return groups;
}

export function buildRouteInstructions(graph: RoutingGraph, route: RouteResult, start: NamedPlaceRecord, destination: NamedPlaceRecord): RouteStep[] {
  const steps: RouteStep[] = [];
  if (start.access.distanceMeters > 0) steps.push({ kind: 'access', distanceMeters: start.access.distanceMeters, floorFrom: start.floorId, floorTo: start.floorId, edgeIds: [] });
  for (const group of groupEdges(routeEdges(graph, route))) {
    const first = group.edges[0];
    const last = group.edges.at(-1) ?? first;
    const distanceMeters = Number(group.edges.reduce((total, edge) => total + edge.distanceMeters, 0).toFixed(3));
    const edgeIds = group.edges.map((edge) => edge.id.replace(/:reverse$/, ''));
    if (first.floorFrom !== last.floorTo) {
      steps.push({ kind: 'transition', distanceMeters, floorFrom: first.floorFrom, floorTo: last.floorTo, movement: first.kind, edgeIds });
      continue;
    }
    const kind = group.turnDegrees !== undefined && group.turnDegrees > STRAIGHT_ANGLE_THRESHOLD_DEGREES ? 'turn-right' : group.turnDegrees !== undefined && group.turnDegrees < -STRAIGHT_ANGLE_THRESHOLD_DEGREES ? 'turn-left' : 'continue';
    steps.push({ kind, distanceMeters, floorFrom: first.floorFrom, floorTo: last.floorTo, movement: first.kind, edgeIds });
  }
  steps.push({ kind: 'arrive', distanceMeters: destination.access.distanceMeters, floorFrom: destination.floorId, floorTo: destination.floorId, edgeIds: [] });
  return steps;
}
