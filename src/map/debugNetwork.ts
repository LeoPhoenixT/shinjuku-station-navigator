import type { OfficialNetworkDataset } from '../types/officialNetwork.js';
import { displayPoint } from './stackedElevation.js';

type Point3 = [number, number, number];
export type DebugNetworkSegment = [Point3, Point3];

function sourceLinkSegments(dataset: OfficialNetworkDataset, floors: string[], stacked: boolean, predicate: (edge: OfficialNetworkDataset['edges'][number]) => boolean): DebugNetworkSegment[] {
  return dataset.edges
    .filter((edge) => predicate(edge) && floors.includes(edge.floorFrom) && floors.includes(edge.floorTo))
    .flatMap((edge) => edge.geometry.slice(1).map((point, index) => [
      displayPoint(edge.geometry[index], stacked),
      displayPoint(point, stacked),
    ] as DebugNetworkSegment));
}

/** Returns every valid raw source link for visual comparison with source viewers. */
export function allSourceLinkSegments(dataset: OfficialNetworkDataset, floors: string[], stacked: boolean): DebugNetworkSegment[] {
  return sourceLinkSegments(dataset, floors, stacked, () => true);
}
