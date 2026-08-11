import type { OfficialNetworkDataset } from '../types/officialNetwork.js';
import type { GraphEdge, GraphNode, RoutingGraph } from './types.js';

function edgeKind(kind: OfficialNetworkDataset['edges'][number]['kind']): GraphEdge['kind'] {
  return kind === 'stairs' ? 'stairs' : kind;
}

function reverseEdge(edge: GraphEdge): GraphEdge {
  return { ...edge, id: `${edge.id}:reverse`, from: edge.to, to: edge.from, floorFrom: edge.floorTo, floorTo: edge.floorFrom, geometry: [...edge.geometry].reverse() };
}

function sourceCode(edge: OfficialNetworkDataset['edges'][number], field: string): string {
  return String(edge.sourceProperties[field] ?? '99');
}

function accessibility(edge: OfficialNetworkDataset['edges'][number]): Pick<GraphEdge, 'accessibility' | 'accessibilityReasons' | 'accessibilityUnknowns'> {
  const reasons: string[] = [];
  const unknowns: string[] = [];
  const width = sourceCode(edge, 'width');
  const slope = sourceCode(edge, 'vtcl_slope');
  const levelDifference = sourceCode(edge, 'lev_diff');
  const elevator = sourceCode(edge, 'elevator');

  if (edge.kind === 'stairs') reasons.push('stairs');
  if (edge.kind === 'escalator') reasons.push('escalator');
  if (width === '1') reasons.push('width-under-1m');
  else if (width === '99') unknowns.push('width');
  if (slope === '2' || slope === '3') reasons.push('slope-over-5-percent');
  else if (slope === '99') unknowns.push('vertical-slope');
  if (levelDifference === '2') reasons.push('level-difference-over-2cm');
  else if (levelDifference === '99') unknowns.push('level-difference');
  if (edge.kind === 'elevator') {
    if (elevator === '2' || elevator === '4') reasons.push('elevator-not-wheelchair-equipped');
    else if (elevator !== '3' && elevator !== '5') unknowns.push('wheelchair-elevator-equipment');
  }
  return {
    accessibility: reasons.length > 0 ? 'no' : unknowns.length > 0 ? 'unknown' : 'yes',
    accessibilityReasons: reasons,
    accessibilityUnknowns: unknowns,
  };
}

export function buildOfficialGraph(dataset: OfficialNetworkDataset): RoutingGraph {
  const sourceNodes = new Map(dataset.nodes.map((node) => [node.id, node]));
  const nodes = dataset.nodes.map<GraphNode>((node) => ({
    id: node.id,
    sourceId: node.id,
    x: node.coordinates[0],
    y: node.coordinates[1],
    z: node.coordinates[2],
    floorId: node.floorId,
    facilityId: dataset.selection.facilityId,
    kind: 'normal',
    inOut: node.inOut,
  })).sort((a, b) => a.id.localeCompare(b.id));
  const edges = dataset.edges.filter((edge) => edge.validatedForRouting).map<GraphEdge>((edge) => ({
    id: edge.id,
    sourceId: edge.id,
    from: edge.from,
    to: edge.to,
    // Some source elevator links report zero distance despite spanning space.
    // Preserve that source value in the processed dataset, but never model
    // physical movement as free in the routing graph.
    distanceMeters: edge.distanceMeters > 0 ? edge.distanceMeters : edge.geometryDistanceMeters,
    direction: edge.direction,
    kind: edgeKind(edge.kind),
    ...accessibility(edge),
    floorFrom: sourceNodes.get(edge.from)?.floorId ?? edge.floorFrom,
    floorTo: sourceNodes.get(edge.to)?.floorId ?? edge.floorTo,
    geometry: edge.geometry,
  })).sort((a, b) => a.id.localeCompare(b.id));
  const adjacency: Record<string, GraphEdge[]> = Object.fromEntries(nodes.map(({ id }) => [id, []]));
  for (const edge of edges) {
    if (edge.direction !== 'reverse') adjacency[edge.from]?.push(edge);
    if (edge.direction !== 'forward') adjacency[edge.to]?.push(reverseEdge(edge));
  }
  for (const list of Object.values(adjacency)) list.sort((a, b) => a.to.localeCompare(b.to) || a.id.localeCompare(b.id));
  return { nodes, edges, adjacency, rejectedEdges: [] };
}
