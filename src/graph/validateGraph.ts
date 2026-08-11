import type { Accessibility, RoutingGraph } from './types';

export interface ConnectedComponentReport { id: number; nodeIds: string[] }
export interface GraphValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    nodeCount: number;
    edgeCount: number;
    floorCount: number;
    facilityCount: number;
    connectedComponentCount: number;
    isolatedNodeCount: number;
    invalidEdgeReferenceCount: number;
    duplicateNodeCount: number;
    nearDuplicateNodeCount: number;
    snappedConnectionCount: number;
    synthesizedConnectionCount: number;
    verticalConnectorCountByType: Record<string, number>;
    oneWayEdgeCount: number;
    accessibilityCounts: Record<Accessibility, number>;
  };
  components: ConnectedComponentReport[];
  isolatedNodeIds: string[];
  duplicateNodeIds: string[];
  nearDuplicateNodePairs: Array<[string, string]>;
}

const NEAR_DUPLICATE_TOLERANCE_METERS = 0.05;

function components(graph: RoutingGraph): ConnectedComponentReport[] {
  const visited = new Set<string>();
  const reports: ConnectedComponentReport[] = [];
  for (const node of graph.nodes) {
    if (visited.has(node.id)) continue;
    const stack = [node.id];
    const nodeIds: string[] = [];
    visited.add(node.id);
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;
      nodeIds.push(current);
      for (const edge of graph.adjacency[current] ?? []) {
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          stack.push(edge.to);
        }
      }
    }
    nodeIds.sort((a, b) => a.localeCompare(b));
    reports.push({ id: reports.length + 1, nodeIds });
  }
  return reports.sort((a, b) => b.nodeIds.length - a.nodeIds.length || a.nodeIds[0].localeCompare(b.nodeIds[0]));
}

export function validateGraph(graph: RoutingGraph): GraphValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeIds = new Set<string>();
  const duplicateNodeIds: string[] = [];
  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) duplicateNodeIds.push(node.id);
    nodeIds.add(node.id);
  }
  const invalidEdgeReferences = graph.edges.filter((edge) => !nodeIds.has(edge.from) || !nodeIds.has(edge.to));
  const nearDuplicateNodePairs: Array<[string, string]> = [];
  for (let a = 0; a < graph.nodes.length; a += 1) {
    for (let b = a + 1; b < graph.nodes.length; b += 1) {
      const first = graph.nodes[a];
      const second = graph.nodes[b];
      if (first.floorId === second.floorId && Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z) <= NEAR_DUPLICATE_TOLERANCE_METERS) {
        nearDuplicateNodePairs.push([first.id, second.id]);
      }
    }
  }
  const reports = components(graph);
  const incidentNodeIds = new Set<string>();
  for (const edge of graph.edges) {
    incidentNodeIds.add(edge.from);
    incidentNodeIds.add(edge.to);
  }
  const isolatedNodeIds = graph.nodes.filter((node) => !incidentNodeIds.has(node.id)).map((node) => node.id).sort((a, b) => a.localeCompare(b));
  const accessibilityCounts: Record<Accessibility, number> = { yes: 0, no: 0, unknown: 0 };
  const verticalConnectorCountByType: Record<string, number> = { stairs: 0, escalator: 0, elevator: 0 };
  let oneWayEdgeCount = 0;
  for (const edge of graph.edges) {
    accessibilityCounts[edge.accessibility] += 1;
    if (edge.direction !== 'both') oneWayEdgeCount += 1;
    if (edge.floorFrom !== edge.floorTo && edge.kind in verticalConnectorCountByType) verticalConnectorCountByType[edge.kind] += 1;
  }
  if (graph.rejectedEdges.length > 0) errors.push(`${graph.rejectedEdges.length} source TWSI lines reference missing nodes or malformed geometry.`);
  if (invalidEdgeReferences.length > 0) errors.push(`${invalidEdgeReferences.length} graph edges reference missing nodes.`);
  if (duplicateNodeIds.length > 0) errors.push(`${duplicateNodeIds.length} duplicate node ids found.`);
  if (nearDuplicateNodePairs.length > 0) warnings.push(`${nearDuplicateNodePairs.length} near-duplicate node pairs found within ${NEAR_DUPLICATE_TOLERANCE_METERS} m.`);
  if (isolatedNodeIds.length > 0) warnings.push(`${isolatedNodeIds.length} isolated nodes found.`);
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      floorCount: new Set(graph.nodes.map((node) => node.floorId)).size,
      facilityCount: new Set(graph.nodes.map((node) => node.facilityId)).size,
      connectedComponentCount: reports.length,
      isolatedNodeCount: isolatedNodeIds.length,
      invalidEdgeReferenceCount: graph.rejectedEdges.length + invalidEdgeReferences.length,
      duplicateNodeCount: duplicateNodeIds.length,
      nearDuplicateNodeCount: nearDuplicateNodePairs.length,
      snappedConnectionCount: 0,
      synthesizedConnectionCount: 0,
      verticalConnectorCountByType,
      oneWayEdgeCount,
      accessibilityCounts,
    },
    components: reports,
    isolatedNodeIds,
    duplicateNodeIds,
    nearDuplicateNodePairs,
  };
}
