import type { GraphEdge } from '../graph/types.js';
import { displayPoint } from './stackedElevation.js';

type Point3 = [number, number, number];

export interface NetworkDirectionArrow {
  edgeId: string;
  position: Point3;
  direction: Point3;
}

function distance(start: Point3, end: Point3): number {
  return Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
}

function arrowForEdge(edge: GraphEdge, stacked: boolean): NetworkDirectionArrow | undefined {
  const sourcePoints = edge.direction === 'reverse' ? [...edge.geometry].reverse() : edge.geometry;
  const points = sourcePoints.map((point) => displayPoint(point, stacked));
  const lengths = points.slice(1).map((point, index) => distance(points[index], point));
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  if (totalLength <= 0) return undefined;

  const midpoint = totalLength / 2;
  let travelled = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    const segmentLength = lengths[index];
    if (segmentLength <= 0 || travelled + segmentLength < midpoint) {
      travelled += segmentLength;
      continue;
    }
    const start = points[index];
    const end = points[index + 1];
    const ratio = (midpoint - travelled) / segmentLength;
    return {
      edgeId: edge.id,
      position: [start[0] + (end[0] - start[0]) * ratio, start[1] + (end[1] - start[1]) * ratio, start[2] + (end[2] - start[2]) * ratio],
      direction: [(end[0] - start[0]) / segmentLength, (end[1] - start[1]) / segmentLength, (end[2] - start[2]) / segmentLength],
    };
  }
  return undefined;
}

export function networkDirectionArrows(edges: GraphEdge[], floors: string[], stacked: boolean): NetworkDirectionArrow[] {
  const visibleFloors = new Set(floors);
  return edges.flatMap((edge) => {
    if (edge.direction === 'both' || !visibleFloors.has(edge.floorFrom) || !visibleFloors.has(edge.floorTo)) return [];
    const arrow = arrowForEdge(edge, stacked);
    return arrow ? [arrow] : [];
  });
}
