import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildFacilityMarkerCandidates, FACILITY_MARKER_ALIGNMENT_LIMIT_METERS, summarizeFacilityMarkerCandidates } from '../src/map/facilityMarkers.js';
import type { OfficialNetworkDataset } from '../src/schema/processed.js';
import type { ProcessedDataset } from '../src/types/processed.js';
import { isMainModule } from './data/is-main-module.js';

export function buildFacilityMarkerReport(mapFile = 'public/data/processed/shinjuku-full-map.json', networkFile = 'public/data/processed/jr-shinjuku-ticket-gates-b1-official-network.json', output = 'reports/facility-marker-review.json'): void {
  const map = JSON.parse(readFileSync(mapFile, 'utf8')) as ProcessedDataset;
  const network = JSON.parse(readFileSync(networkFile, 'utf8')) as OfficialNetworkDataset;
  const candidates = buildFacilityMarkerCandidates(map.features, network.nodes.map((node) => ({ id: node.id, floorId: node.floorId, x: node.coordinates[0], z: node.coordinates[2] })));
  const report = {
    schemaVersion: 1,
    generatedAt: '2026-07-20T00:00:00.000Z',
    selectionRule: `Known useful Facility category, normalized floor, Point geometry, clear or absent source label, and same-floor official node within ${FACILITY_MARKER_ALIGNMENT_LIMIT_METERS} m; exact local duplicates are review-only.`,
    source: { mapFile: path.basename(mapFile), networkFile: path.basename(networkFile) },
    statistics: {
      rawFacilityCount: map.features.filter(({ layer }) => layer === 'Facility').length,
      ...summarizeFacilityMarkerCandidates(candidates),
    },
    candidates: candidates.map(({ id, sourceId, sourceRecord, sourceFacility, categoryCode, sourceName, label, floorId, coordinates, alignmentNodeId, alignmentDistanceMeters, status, reviewReason }) => ({
      id, sourceId, sourceRecord, sourceFacility, categoryCode, sourceName, label, floorId, coordinates, alignmentNodeId, alignmentDistanceMeters, status, reviewReason,
    })),
  };
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
}

if (isMainModule(import.meta.url)) {
  buildFacilityMarkerReport(process.argv[2], process.argv[3], process.argv[4]);
  console.log('Built deterministic Facility marker review report.');
}
