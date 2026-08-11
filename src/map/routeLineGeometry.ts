import { floorElevationMeters } from '../data/floors.js';
import type { RoutingGraph } from '../graph/types.js';
import type { RoutePlan } from '../routing/routeService.js';
import { displayPoint } from './stackedElevation.js';

export type RoutePoint3 = [number, number, number];

export interface RouteDirectionCue {
  edgeId: string;
  position: RoutePoint3;
  direction: RoutePoint3;
}

export interface RouteTransitionMarker {
  edgeId: string;
  position: RoutePoint3;
  movement: 'stairs' | 'escalator' | 'elevator' | 'corridor' | 'gate';
  floorFrom: string;
  floorTo: string;
}

function distance(start: RoutePoint3, end: RoutePoint3): number {
  return Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
}

function midpointCue(edgeId: string, points: RoutePoint3[]): RouteDirectionCue | undefined {
  const lengths = points.slice(1).map((point, index) => distance(points[index], point));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total <= 0) return undefined;
  let travelled = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    const segmentLength = lengths[index];
    if (segmentLength <= 0 || travelled + segmentLength < total / 2) {
      travelled += segmentLength;
      continue;
    }
    const start = points[index];
    const end = points[index + 1];
    const ratio = (total / 2 - travelled) / segmentLength;
    return {
      edgeId,
      position: [start[0] + (end[0] - start[0]) * ratio, start[1] + (end[1] - start[1]) * ratio, start[2] + (end[2] - start[2]) * ratio],
      direction: [(end[0] - start[0]) / segmentLength, (end[1] - start[1]) / segmentLength, (end[2] - start[2]) / segmentLength],
    };
  }
  return undefined;
}

function traversedEdges(route: Extract<RoutePlan, { status: 'ok' }>, graph: RoutingGraph) {
  const edges = new Map(graph.edges.map((edge) => [edge.id, edge]));
  return route.network.edgeIds.flatMap((id, index) => {
    const edge = edges.get(id.replace(/:reverse$/, ''));
    if (!edge) return [];
    const reversed = route.network.nodeIds[index] !== edge.from;
    return [{ edge, reversed }];
  });
}

export function routeLineSegmentPositions(lines: RoutePoint3[][], yOffset: number): number[] {
  return lines.flatMap((points) => points.slice(1).flatMap((point, index) => {
    const start = points[index];
    return [start[0], start[1] + yOffset, start[2], point[0], point[1] + yOffset, point[2]];
  }));
}

export function routePolylines(route: RoutePlan, floors: string[], stacked: boolean): RoutePoint3[][] {
  if (route.status !== 'ok') return [];
  const elevations = floors.map(floorElevationMeters);
  return route.legs.flatMap((leg) => {
    const lines: RoutePoint3[][] = [];
    let current: RoutePoint3[] = [];
    for (let index = 1; index < leg.geometry.length; index += 1) {
      const start = leg.geometry[index - 1];
      const end = leg.geometry[index];
      const visible = elevations.some((elevation) => Math.abs(start[1] - elevation) < 0.01 && Math.abs(end[1] - elevation) < 0.01);
      if (!visible) {
        if (current.length > 1) lines.push(current);
        current = [];
        continue;
      }
      if (current.length === 0) current.push(displayPoint(start, stacked));
      current.push(displayPoint(end, stacked));
    }
    if (current.length > 1) lines.push(current);
    return lines;
  });
}

export function routeTransitionPolylines(route: RoutePlan, graph: RoutingGraph, floors: string[], stacked: boolean): RoutePoint3[][] {
  if (route.status !== 'ok') return [];
  const visibleFloors = new Set(floors);
  const edges = new Map(graph.edges.map((edge) => [edge.id, edge]));
  return route.network.edgeIds.flatMap((id) => {
    const edge = edges.get(id.replace(/:reverse$/, ''));
    if (!edge || edge.floorFrom === edge.floorTo || !visibleFloors.has(edge.floorFrom) || !visibleFloors.has(edge.floorTo)) return [];
    return [edge.geometry.map((point) => displayPoint(point, stacked))];
  });
}

export function routeDirectionCues(route: RoutePlan, graph: RoutingGraph, floors: string[], stacked: boolean, minimumLengthMeters = 10): RouteDirectionCue[] {
  if (route.status !== 'ok') return [];
  const visibleFloors = new Set(floors);
  return traversedEdges(route, graph).flatMap(({ edge, reversed }) => {
    if (edge.floorFrom !== edge.floorTo || !visibleFloors.has(edge.floorFrom) || edge.distanceMeters < minimumLengthMeters) return [];
    const geometry = reversed ? [...edge.geometry].reverse() : edge.geometry;
    const cue = midpointCue(edge.id, geometry.map((point) => displayPoint(point, stacked)));
    return cue ? [cue] : [];
  });
}

export function routeTransitionMarkers(route: RoutePlan, graph: RoutingGraph, floors: string[], stacked: boolean): RouteTransitionMarker[] {
  if (route.status !== 'ok') return [];
  const visibleFloors = new Set(floors);
  return traversedEdges(route, graph).flatMap(({ edge, reversed }) => {
    if (edge.floorFrom === edge.floorTo || !visibleFloors.has(edge.floorFrom) || !visibleFloors.has(edge.floorTo)) return [];
    const geometry = reversed ? [...edge.geometry].reverse() : edge.geometry;
    const cue = midpointCue(edge.id, geometry.map((point) => displayPoint(point, stacked)));
    if (!cue) return [];
    return [{ edgeId: edge.id, position: cue.position, movement: edge.kind, floorFrom: reversed ? edge.floorTo : edge.floorFrom, floorTo: reversed ? edge.floorFrom : edge.floorTo }];
  });
}
