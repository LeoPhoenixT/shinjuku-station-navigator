import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseOfficialNetwork, type OfficialNetworkDataset } from '../src/schema/processed.js';
import { isMainModule } from './data/is-main-module.js';

interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  sourceId?: string;
  message: string;
}

interface OfficialNetworkValidationSummary {
  nodeCount: number;
  edgeCount: number;
  invalidReferenceCount: number;
  duplicateNodeCount: number;
  duplicateEdgeCount: number;
  endpointMisalignmentCount: number;
  floorAssignmentErrorCount: number;
  crossFloorLinkCount: number;
  unvalidatedCrossFloorLinkCount: number;
  connectedComponentCount: number;
  isolatedNodeCount: number;
  boundaryLinkCount: number;
  maximumEndpointOffsetMeters: number;
  maximumDistanceDifferenceMeters: number;
}

export interface OfficialNetworkValidationReport {
  generatedAt: string;
  input: string;
  valid: boolean;
  issues: ValidationIssue[];
  summary: OfficialNetworkValidationSummary;
}

const INPUT = 'public/data/processed/jr-shinjuku-ticket-gates-b1-official-network.json';
const OUTPUT = 'reports/official-network-validation.json';
const ENDPOINT_TOLERANCE_METERS = 0.1;

function distance(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function duplicateCount(ids: string[]): number {
  return ids.length - new Set(ids).size;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function records(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.flatMap((entry) => {
    const result = record(entry);
    return result ? [result] : [];
  }) : [];
}

function stringIds(values: Array<Record<string, unknown>>): string[] {
  return values.flatMap(({ id }) => typeof id === 'string' ? [id] : []);
}

function preflightSummary(value: unknown): OfficialNetworkValidationSummary {
  const root = record(value);
  const nodes = records(root?.nodes);
  const edges = records(root?.edges);
  const nodeIds = stringIds(nodes);
  const nodeIdSet = new Set(nodeIds);
  const edgeIds = stringIds(edges);
  const invalidReferenceCount = edges.filter(({ from, to }) => (
    typeof from !== 'string'
    || typeof to !== 'string'
    || !nodeIdSet.has(from)
    || !nodeIdSet.has(to)
  )).length;
  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    invalidReferenceCount,
    duplicateNodeCount: duplicateCount(nodeIds),
    duplicateEdgeCount: duplicateCount(edgeIds),
    endpointMisalignmentCount: 0,
    floorAssignmentErrorCount: 0,
    crossFloorLinkCount: edges.filter(({ floorFrom, floorTo }) => (
      typeof floorFrom === 'string' && typeof floorTo === 'string' && floorFrom !== floorTo
    )).length,
    unvalidatedCrossFloorLinkCount: edges.filter(({ floorFrom, floorTo, validatedForRouting }) => (
      typeof floorFrom === 'string'
      && typeof floorTo === 'string'
      && floorFrom !== floorTo
      && validatedForRouting !== true
    )).length,
    connectedComponentCount: 0,
    isolatedNodeCount: 0,
    boundaryLinkCount: 0,
    maximumEndpointOffsetMeters: 0,
    maximumDistanceDifferenceMeters: 0,
  };
}

function reportForSchemaFailure(
  value: unknown,
  inputLabel: string,
  reason: unknown,
): OfficialNetworkValidationReport {
  const summary = preflightSummary(value);
  const issues: ValidationIssue[] = [];
  if (summary.duplicateNodeCount > 0) {
    issues.push({ severity: 'error', code: 'duplicate-nodes', message: `${summary.duplicateNodeCount} duplicate node IDs.` });
  }
  if (summary.duplicateEdgeCount > 0) {
    issues.push({ severity: 'error', code: 'duplicate-edges', message: `${summary.duplicateEdgeCount} duplicate edge IDs.` });
  }
  if (summary.invalidReferenceCount > 0) {
    issues.push({ severity: 'error', code: 'invalid-reference', message: `${summary.invalidReferenceCount} links have missing or malformed endpoint references.` });
  }
  issues.push({
    severity: 'error',
    code: 'schema-validation',
    message: reason instanceof Error ? reason.message : 'Official-network input failed runtime validation.',
  });
  return {
    generatedAt: new Date(0).toISOString(),
    input: inputLabel,
    valid: false,
    issues,
    summary,
  };
}

function validateParsedNetwork(
  dataset: OfficialNetworkDataset,
  inputLabel: string,
): OfficialNetworkValidationReport {
  const issues: ValidationIssue[] = [];
  const nodes = new Map(dataset.nodes.map((node) => [node.id, node]));
  const duplicateNodeCount = duplicateCount(dataset.nodes.map(({ id }) => id));
  const duplicateEdgeCount = duplicateCount(dataset.edges.map(({ id }) => id));
  if (duplicateNodeCount > 0) {
    issues.push({ severity: 'error', code: 'duplicate-nodes', message: `${duplicateNodeCount} duplicate node IDs.` });
  }
  if (duplicateEdgeCount > 0) {
    issues.push({ severity: 'error', code: 'duplicate-edges', message: `${duplicateEdgeCount} duplicate edge IDs.` });
  }
  const expectedFloor = new Map(dataset.selection.ordinals.map((ordinal, index) => [ordinal, dataset.selection.floorIds[index]]));
  const floorAssignmentErrorCount = dataset.nodes.filter((node) => node.floorId !== expectedFloor.get(node.ordinal)).length;
  if (floorAssignmentErrorCount > 0) {
    issues.push({ severity: 'error', code: 'floor-assignment', message: `${floorAssignmentErrorCount} nodes do not match the selected floor and ordinal.` });
  }
  let invalidReferenceCount = 0;
  let endpointMisalignmentCount = 0;
  let maximumEndpointOffsetMeters = 0;
  for (const edge of dataset.edges) {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) {
      invalidReferenceCount += 1;
      issues.push({ severity: 'error', code: 'invalid-reference', sourceId: edge.id, message: `Missing endpoint for ${edge.from} → ${edge.to}.` });
      continue;
    }
    if (edge.floorFrom !== from.floorId || edge.floorTo !== to.floorId) {
      issues.push({ severity: 'error', code: 'edge-floor-assignment', sourceId: edge.id, message: 'Edge floor metadata does not match its endpoints.' });
    }
    if (!edge.validatedForRouting) {
      issues.push({ severity: 'error', code: 'disabled-source-link', sourceId: edge.id, message: 'A valid source link is unexpectedly excluded from routing.' });
    }
    const startOffset = distance(from.coordinates, edge.geometry[0]);
    const endOffset = distance(to.coordinates, edge.geometry.at(-1)!);
    const reversedStartOffset = distance(from.coordinates, edge.geometry.at(-1)!);
    const reversedEndOffset = distance(to.coordinates, edge.geometry[0]);
    const offset = Math.min(
      Math.max(startOffset, endOffset),
      Math.max(reversedStartOffset, reversedEndOffset),
    );
    maximumEndpointOffsetMeters = Math.max(maximumEndpointOffsetMeters, offset);
    if (offset > ENDPOINT_TOLERANCE_METERS) {
      endpointMisalignmentCount += 1;
      issues.push({
        severity: 'error',
        code: 'endpoint-misalignment',
        sourceId: edge.id,
        message: `Link geometry endpoints differ from referenced nodes by up to ${offset.toFixed(3)} m.`,
      });
    }
  }
  if (dataset.statistics.boundaryLinkCount > 0) {
    issues.push({
      severity: dataset.selection.coverage === 'full-source' ? 'error' : 'warning',
      code: 'boundary-links',
      message: `${dataset.statistics.boundaryLinkCount} links cross the selected node scope.`,
    });
  }
  if (dataset.statistics.connectedComponentCount > 1) {
    issues.push({ severity: 'warning', code: 'disconnected-components', message: `The official network contains ${dataset.statistics.connectedComponentCount} connected components.` });
  }
  if (dataset.statistics.isolatedNodeCount > 0) {
    issues.push({ severity: 'warning', code: 'isolated-nodes', message: `The official network contains ${dataset.statistics.isolatedNodeCount} isolated nodes.` });
  }
  return {
    generatedAt: new Date(0).toISOString(),
    input: inputLabel,
    valid: issues.every(({ severity }) => severity !== 'error'),
    issues,
    summary: {
      nodeCount: dataset.nodes.length,
      edgeCount: dataset.edges.length,
      invalidReferenceCount,
      duplicateNodeCount,
      duplicateEdgeCount,
      endpointMisalignmentCount,
      floorAssignmentErrorCount,
      crossFloorLinkCount: dataset.edges.filter((edge) => edge.floorFrom !== edge.floorTo).length,
      unvalidatedCrossFloorLinkCount: dataset.edges.filter((edge) => edge.floorFrom !== edge.floorTo && !edge.validatedForRouting).length,
      connectedComponentCount: dataset.statistics.connectedComponentCount,
      isolatedNodeCount: dataset.statistics.isolatedNodeCount,
      boundaryLinkCount: dataset.statistics.boundaryLinkCount,
      maximumEndpointOffsetMeters: Number(maximumEndpointOffsetMeters.toFixed(3)),
      maximumDistanceDifferenceMeters: dataset.statistics.maxDistanceDifferenceMeters,
    },
  };
}

export function validateOfficialNetworkValue(
  value: unknown,
  inputLabel = 'in-memory official network',
): OfficialNetworkValidationReport {
  try {
    return validateParsedNetwork(parseOfficialNetwork(value), inputLabel);
  } catch (reason: unknown) {
    return reportForSchemaFailure(value, inputLabel, reason);
  }
}

export function validateOfficialNetwork(
  input = INPUT,
  output = OUTPUT,
  inputLabel = input,
): OfficialNetworkValidationReport {
  let report: OfficialNetworkValidationReport;
  try {
    const value: unknown = JSON.parse(readFileSync(input, 'utf8'));
    report = validateOfficialNetworkValue(value, inputLabel);
  } catch (reason: unknown) {
    report = reportForSchemaFailure(undefined, inputLabel, reason);
  }
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (isMainModule(import.meta.url)) {
  const report = validateOfficialNetwork(process.argv[2] ?? INPUT, process.argv[3] ?? OUTPUT);
  console.log(`${report.valid ? 'Valid' : 'Invalid'} official network: ${report.summary.nodeCount} nodes, ${report.summary.edgeCount} links, ${report.issues.length} issues.`);
  if (!report.valid) process.exitCode = 1;
}
