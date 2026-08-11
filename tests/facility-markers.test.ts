import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { NamedPlacesDataset, OfficialNetworkDataset } from '../src/schema/processed';
import { buildFacilityMarkerCandidates, FACILITY_MARKER_LIMIT, routablePlaceForFacility, selectVisibleFacilityMarkers } from '../src/map/facilityMarkers';
import type { ProcessedDataset } from '../src/types/processed';

function generatedCandidates() {
  const map = JSON.parse(readFileSync('public/data/processed/shinjuku-full-map.json', 'utf8')) as ProcessedDataset;
  const network = JSON.parse(readFileSync('public/data/processed/jr-shinjuku-ticket-gates-b1-official-network.json', 'utf8')) as OfficialNetworkDataset;
  return buildFacilityMarkerCandidates(map.features, network.nodes.map((node) => ({ id: node.id, floorId: node.floorId, x: node.coordinates[0], z: node.coordinates[2] })));
}

describe('curated Facility markers', () => {
  it('reports useful candidates separately from public and review-only markers', () => {
    const candidates = generatedCandidates();
    const report = JSON.parse(readFileSync('reports/facility-marker-review.json', 'utf8')) as { statistics: { rawFacilityCount: number; candidateCount: number; publicMarkerCount: number; reviewOnlyCount: number } };
    expect(candidates).toHaveLength(637);
    expect(candidates.filter(({ status }) => status === 'public')).toHaveLength(464);
    expect(candidates.filter(({ status }) => status === 'review')).toHaveLength(173);
    expect(candidates.some(({ reviewReason }) => reviewReason === 'unclear-source-label')).toBe(true);
    expect(candidates.some(({ reviewReason }) => reviewReason === 'network-misalignment')).toBe(true);
    expect(report.statistics).toMatchObject({ rawFacilityCount: 639, candidateCount: 637, publicMarkerCount: 464, reviewOnlyCount: 173 });
  });

  it('uses accessible text icons and excludes raw code-only labels from publication', () => {
    const candidates = generatedCandidates();
    expect(candidates.every(({ icon, label }) => icon.length > 0 && label.length > 0)).toBe(true);
    expect(candidates.filter(({ sourceName }) => sourceName && /^[A-Z]?\d+$/.test(sourceName)).every(({ status }) => status === 'review')).toBe(true);
    expect(candidates.find(({ sourceName }) => sourceName === '安田口')).toMatchObject({ status: 'public', label: 'Exit · 安田口' });
  });

  it('declutters deterministically by priority, zoom, floor visibility, and marker limit', () => {
    const candidates = generatedCandidates();
    const overview = selectVisibleFacilityMarkers(candidates, ['B1'], 0.5);
    const detail = selectVisibleFacilityMarkers(candidates, ['B1'], 3);
    expect(overview.length).toBeLessThanOrEqual(FACILITY_MARKER_LIMIT);
    expect(detail.length).toBeGreaterThan(overview.length);
    expect(detail.every(({ floorId, status }) => floorId === 'B1' && status === 'public')).toBe(true);
    expect(selectVisibleFacilityMarkers(candidates, ['B1'], 3)).toEqual(detail);
  });

  it('offers route actions only for exact Facility provenance matches', () => {
    const candidates = generatedCandidates();
    const places = (JSON.parse(readFileSync('public/data/processed/shinjuku-b1-named-places.json', 'utf8')) as NamedPlacesDataset).places;
    const place = places.find(({ sourceLayer, routable }) => sourceLayer === 'Facility' && routable);
    expect(place).toBeDefined();
    const marker = candidates.find(({ sourceId, floorId }) => sourceId === place?.sourceId && floorId === place.floorId);
    expect(marker).toBeDefined();
    expect(routablePlaceForFacility(marker!, places)?.id).toBe(place?.id);
    expect(routablePlaceForFacility({ ...marker!, sourceId: 'unreviewed-source' }, places)).toBeUndefined();
  });
});
