import type { ProcessedFeature } from '../types/processed.js';
import { displayPoint } from './stackedElevation.js';
import { FLOOR_ENVELOPE_HEIGHT_METERS } from './viewerPresentation.js';

export type Point3 = [number, number, number];
export type Segment = [Point3, Point3];

function polygonEnvelopeSegments(feature: ProcessedFeature, stacked: boolean): Segment[] {
  if (feature.geometry.type !== 'Polygon') return [];
  return feature.geometry.parts.flatMap((part) => {
    const closed = part.length > 2 && part[0][0] === part.at(-1)?.[0] && part[0][2] === part.at(-1)?.[2];
    const points = closed ? part.slice(0, -1) : part;
    if (points.length < 3) return [];
    return points.flatMap((point, index) => {
      const next = points[(index + 1) % points.length];
      const base = displayPoint(point, stacked);
      const nextBase = displayPoint(next, stacked);
      const top: Point3 = [base[0], base[1] + FLOOR_ENVELOPE_HEIGHT_METERS, base[2]];
      const nextTop: Point3 = [nextBase[0], nextBase[1] + FLOOR_ENVELOPE_HEIGHT_METERS, nextBase[2]];
      return [[top, nextTop] as Segment, [base, top] as Segment];
    });
  });
}

export function wallEnvelopeSegments(features: ProcessedFeature[], floors: string[], stacked: boolean): Segment[] {
  return floors.flatMap((floorId) => {
    const floorFeatures = features.filter((feature) => feature.floorId === floorId && feature.geometry.type === 'Polygon');
    const structuralFeatures = floorFeatures.filter((feature) => feature.layer === 'Floor' || feature.layer === 'Space');
    const envelopeFeatures = structuralFeatures.length > 0 ? structuralFeatures : floorFeatures.filter((feature) => feature.layer === 'Fixture');
    return envelopeFeatures.flatMap((feature) => polygonEnvelopeSegments(feature, stacked));
  });
}
