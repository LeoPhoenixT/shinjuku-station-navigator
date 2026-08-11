import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { OfficialNetworkSlice } from '../scripts/import-official-network.js';
import { validateOfficialNetworkValue, type OfficialNetworkValidationReport } from '../scripts/validate-official-network.js';
import { buildOfficialGraph } from '../src/graph/buildOfficialGraph.js';
import { classifyNetworkEdgeContext } from '../src/map/networkContext.js';

const dataset = JSON.parse(readFileSync('public/data/processed/jr-shinjuku-ticket-gates-b1-official-network.json', 'utf8')) as OfficialNetworkSlice;
const validation = JSON.parse(readFileSync('reports/official-network-validation.json', 'utf8')) as OfficialNetworkValidationReport;

describe('Phase 7A full official network', () => {
  it('imports every committed official node and link across all ordinals', () => {
    expect(dataset.selection.coverage).toBe('full-source');
    expect(dataset.selection.floorId).toBe('multi-floor');
    expect(dataset.selection.ordinals).toEqual([-3, -2.5, -2, -1.5, -1, -0.5, 0, 1, 1.5, 2, 2.5, 3, 4, 4.5]);
    expect(dataset.nodes).toHaveLength(1982);
    expect(dataset.edges).toHaveLength(2541);
    const nodeIds = new Set(dataset.nodes.map(({ id }) => id));
    expect(dataset.edges.every(({ from, to }) => nodeIds.has(from) && nodeIds.has(to))).toBe(true);
    expect(new Set(dataset.nodes.map(({ id }) => id)).size).toBe(dataset.nodes.length);
    expect(new Set(dataset.edges.map(({ id }) => id)).size).toBe(dataset.edges.length);
  });

  it('preserves official directions and classified movement types', () => {
    expect(dataset.statistics.movementTypeCounts).toEqual({ corridor: 2194, elevator: 79, escalator: 73, stairs: 195 });
    expect(dataset.statistics.crossFloorLinkCount).toBe(253);
    expect(dataset.statistics.unvalidatedCrossFloorLinkCount).toBe(0);
    expect(dataset.statistics.verticalConnectorCounts).toEqual({ elevator: 27, escalator: 58, stairs: 142 });
    expect(dataset.statistics.directionCounts.forward).toBeGreaterThan(0);
    expect(dataset.edges.every(({ distanceMeters }) => distanceMeters >= 0)).toBe(true);
  });

  it('preserves indoor, boundary, and outdoor node context for debug styling', () => {
    const graph = buildOfficialGraph(dataset);
    const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    expect(graph.edges).toHaveLength(dataset.edges.length);
    expect(new Set(graph.nodes.map(({ inOut }) => inOut))).toEqual(new Set(['inside', 'boundary', 'outside']));
    expect(new Set(graph.edges.map((edge) => classifyNetworkEdgeContext(edge, nodes)))).toEqual(new Set(['inside', 'boundary', 'outside']));
  });

  it('persists validation evidence without invalid references or silent endpoint snapping', () => {
    expect(validation.valid).toBe(true);
    expect(validation.summary.invalidReferenceCount).toBe(0);
    expect(validation.summary.duplicateNodeCount).toBe(0);
    expect(validation.summary.duplicateEdgeCount).toBe(0);
    expect(validation.summary.endpointMisalignmentCount).toBe(0);
    expect(validation.summary.floorAssignmentErrorCount).toBe(0);
    expect(validation.summary.boundaryLinkCount).toBe(0);
    expect(validation.summary.crossFloorLinkCount).toBe(253);
    expect(validation.summary.unvalidatedCrossFloorLinkCount).toBe(0);
    expect(dataset.edges.filter(({ validatedForRouting }) => !validatedForRouting)).toHaveLength(0);
  });

  it('returns actionable diagnostics when malformed topology fails runtime parsing', () => {
    const malformed = structuredClone(dataset);
    malformed.nodes[1].id = malformed.nodes[0].id;
    malformed.edges[0].from = 'missing-node';
    const report = validateOfficialNetworkValue(malformed, 'malformed-test-network.json');

    expect(report.valid).toBe(false);
    expect(report.input).toBe('malformed-test-network.json');
    expect(report.summary.duplicateNodeCount).toBe(1);
    expect(report.summary.invalidReferenceCount).toBeGreaterThan(0);
    expect(report.issues.map(({ code }) => code)).toEqual(expect.arrayContaining([
      'duplicate-nodes',
      'invalid-reference',
      'schema-validation',
    ]));
  });
});
