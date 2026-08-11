import { resolveIndoorMapCategory } from '../data/indoorMapCategories.js';
import type { ProcessedFeature } from '../types/processed.js';
import type { NamedPlaceRecord } from '../schema/processed.js';

export interface FacilityAlignmentNode {
  id: string;
  floorId: string;
  x: number;
  z: number;
}

export type FacilityMarkerReviewReason = 'invalid-geometry' | 'missing-floor' | 'unclear-source-label' | 'network-misalignment' | 'duplicate';

export interface FacilityMarkerCandidate {
  id: string;
  sourceId: string;
  sourceRecord: number;
  sourceFacility: string;
  categoryCode: string;
  categoryName: string;
  sourceName?: string;
  label: string;
  icon: string;
  floorId: string;
  coordinates: [number, number, number];
  priority: 1 | 2 | 3;
  minZoom: number;
  alignmentNodeId?: string;
  alignmentDistanceMeters?: number;
  status: 'public' | 'review';
  reviewReason?: FacilityMarkerReviewReason;
}

export function routablePlaceForFacility(marker: FacilityMarkerCandidate, places: NamedPlaceRecord[]): NamedPlaceRecord | undefined {
  return places.find((place) => place.routable && place.sourceLayer === 'Facility' && place.sourceId === marker.sourceId && place.floorId === marker.floorId);
}

interface MarkerPolicy {
  icon: string;
  priority: FacilityMarkerCandidate['priority'];
  minZoom: number;
}

const high = (icon: string): MarkerPolicy => ({ icon, priority: 1, minZoom: 0 });
const medium = (icon: string): MarkerPolicy => ({ icon, priority: 2, minZoom: 0.8 });
const dense = (icon: string): MarkerPolicy => ({ icon, priority: 3, minZoom: 1.8 });

const MARKER_POLICIES: Readonly<Record<string, MarkerPolicy>> = {
  F001: high('WC'), F002: high('WC'), F003: high('WC'), F004: high('WC'),
  F005: high('♿'), F006: high('♿'), F007: high('♿'), F008: high('♿'),
  F011: dense('ST'), F012: high('EL'), F013: medium('ES'), F014: medium('SL'), F015: medium('MW'),
  F017: high('IN'), F018: high('i'), F020: medium('WR'), F021: medium('NR'), F027: high('AED'),
  F030: medium('ATM'), F031: medium('LK'), F038: high('BUS'), F039: high('TX'),
  F101: medium('TK'), F102: medium('TK'), F103: medium('TK'), F106: high('GT'), F108: high('EX'),
};

export const FACILITY_MARKER_ALIGNMENT_LIMIT_METERS = 15;
export const FACILITY_MARKER_LIMIT = 80;

export interface FacilityMarkerSummary {
  candidateCount: number;
  publicMarkerCount: number;
  reviewOnlyCount: number;
  candidateCountsByCategory: Record<string, number>;
  publicCountsByCategory: Record<string, number>;
  reviewReasonCounts: Record<FacilityMarkerReviewReason, number>;
}

function clearSourceName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const name = value.trim();
  if (name.length === 0 || /^(?:不明|unknown|null)$/i.test(name) || /^\d+$/.test(name) || /^[A-Z]{1,2}\d*(?:[´']|（[^）]*）)?$/i.test(name)) return undefined;
  return name;
}

function hasUnclearSourceName(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0 && clearSourceName(value) === undefined;
}

function nearestNode(coordinates: [number, number, number], nodes: FacilityAlignmentNode[]): { node?: FacilityAlignmentNode; distance: number } {
  let node: FacilityAlignmentNode | undefined;
  let distance = Infinity;
  for (const candidate of nodes) {
    const candidateDistance = Math.hypot(candidate.x - coordinates[0], candidate.z - coordinates[2]);
    if (candidateDistance < distance || (candidateDistance === distance && candidate.id.localeCompare(node?.id ?? '') < 0)) {
      node = candidate;
      distance = candidateDistance;
    }
  }
  return { node, distance };
}

export function buildFacilityMarkerCandidates(features: ProcessedFeature[], nodes: FacilityAlignmentNode[]): FacilityMarkerCandidate[] {
  const nodesByFloor = new Map<string, FacilityAlignmentNode[]>();
  for (const node of nodes) nodesByFloor.set(node.floorId, [...(nodesByFloor.get(node.floorId) ?? []), node]);
  const candidates: FacilityMarkerCandidate[] = [];
  const publicKeys = new Set<string>();

  for (const feature of features.filter(({ layer }) => layer === 'Facility').sort((a, b) => a.id.localeCompare(b.id))) {
    const category = resolveIndoorMapCategory('Facility', feature.properties.category);
    const policy = MARKER_POLICIES[category.code];
    if (!category.known || !policy) continue;
    const floorId = feature.floorId ?? '';
    const coordinates = feature.geometry.type === 'Point' ? feature.geometry.coordinates : [0, 0, 0] as [number, number, number];
    const sourceName = clearSourceName(feature.properties.name);
    const sourceFacility = typeof feature.properties.sourceFacility === 'string' ? feature.properties.sourceFacility : '';
    const alignment = nearestNode(coordinates, nodesByFloor.get(floorId) ?? []);
    let reviewReason: FacilityMarkerReviewReason | undefined;
    if (feature.geometry.type !== 'Point') reviewReason = 'invalid-geometry';
    else if (!floorId) reviewReason = 'missing-floor';
    else if (hasUnclearSourceName(feature.properties.name)) reviewReason = 'unclear-source-label';
    else if (!alignment.node || alignment.distance > FACILITY_MARKER_ALIGNMENT_LIMIT_METERS) reviewReason = 'network-misalignment';

    const duplicateKey = `${category.code}:${floorId}:${coordinates[0].toFixed(1)}:${coordinates[2].toFixed(1)}`;
    if (!reviewReason && publicKeys.has(duplicateKey)) reviewReason = 'duplicate';
    if (!reviewReason) publicKeys.add(duplicateKey);
    candidates.push({
      id: `facility-marker:${feature.id}`,
      sourceId: feature.sourceId,
      sourceRecord: feature.sourceRecord,
      sourceFacility,
      categoryCode: category.code,
      categoryName: category.nameEn,
      sourceName,
      label: sourceName ? `${category.nameEn} · ${sourceName}` : category.nameEn,
      icon: policy.icon,
      floorId,
      coordinates,
      priority: policy.priority,
      minZoom: policy.minZoom,
      alignmentNodeId: alignment.node?.id,
      alignmentDistanceMeters: Number.isFinite(alignment.distance) ? Number(alignment.distance.toFixed(3)) : undefined,
      status: reviewReason ? 'review' : 'public',
      reviewReason,
    });
  }
  return candidates;
}

export function selectVisibleFacilityMarkers(candidates: FacilityMarkerCandidate[], floors: string[], zoom: number, limit = FACILITY_MARKER_LIMIT): FacilityMarkerCandidate[] {
  const visibleFloors = new Set(floors);
  const cellSize = 34 / Math.max(zoom, 0.1);
  const occupied = new Set<string>();
  const visible: FacilityMarkerCandidate[] = [];
  const eligible = candidates.filter((candidate) => candidate.status === 'public' && visibleFloors.has(candidate.floorId) && zoom >= candidate.minZoom)
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  for (const candidate of eligible) {
    const cell = `${Math.floor(candidate.coordinates[0] / cellSize)}:${Math.floor(candidate.coordinates[2] / cellSize)}`;
    if (occupied.has(cell)) continue;
    occupied.add(cell);
    visible.push(candidate);
    if (visible.length >= limit) break;
  }
  return visible;
}

export function summarizeFacilityMarkerCandidates(candidates: FacilityMarkerCandidate[]): FacilityMarkerSummary {
  const candidateCountsByCategory: Record<string, number> = {};
  const publicCountsByCategory: Record<string, number> = {};
  const reviewReasonCounts: Record<FacilityMarkerReviewReason, number> = { 'invalid-geometry': 0, 'missing-floor': 0, 'unclear-source-label': 0, 'network-misalignment': 0, duplicate: 0 };
  for (const candidate of candidates) {
    candidateCountsByCategory[candidate.categoryCode] = (candidateCountsByCategory[candidate.categoryCode] ?? 0) + 1;
    if (candidate.status === 'public') publicCountsByCategory[candidate.categoryCode] = (publicCountsByCategory[candidate.categoryCode] ?? 0) + 1;
    else if (candidate.reviewReason) reviewReasonCounts[candidate.reviewReason] += 1;
  }
  return {
    candidateCount: candidates.length,
    publicMarkerCount: candidates.filter(({ status }) => status === 'public').length,
    reviewOnlyCount: candidates.filter(({ status }) => status === 'review').length,
    candidateCountsByCategory: Object.fromEntries(Object.entries(candidateCountsByCategory).sort(([a], [b]) => a.localeCompare(b))),
    publicCountsByCategory: Object.fromEntries(Object.entries(publicCountsByCategory).sort(([a], [b]) => a.localeCompare(b))),
    reviewReasonCounts,
  };
}
