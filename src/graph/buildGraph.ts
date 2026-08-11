import type { ProcessedDataset, ProcessedFeature } from '../types/processed';
import type { GraphEdge, GraphNode, RejectedGraphEdge, RoutingGraph } from './types';

function distance3d(points: Array<[number, number, number]>): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const [ax, ay, az] = points[index - 1];
    const [bx, by, bz] = points[index];
    total += Math.hypot(bx - ax, by - ay, bz - az);
  }
  return Number(total.toFixed(3));
}

function categoryToNodeKind(category: unknown): GraphNode['kind'] {
  return category === '5' ? 'gate' : 'normal';
}

function optionalName(name: unknown): string | undefined {
  return typeof name === 'string' && name.trim().length > 0 ? name.trim() : undefined;
}

function linePoints(feature: ProcessedFeature): Array<[number, number, number]> {
  return feature.geometry.type === 'PolyLine' ? feature.geometry.parts.flat() : [];
}

function referenceReason(hasStart: boolean, hasEnd: boolean): RejectedGraphEdge['reason'] {
  if (!hasStart && !hasEnd) return 'missing-both-nodes';
  return hasStart ? 'missing-end-node' : 'missing-start-node';
}

function qualifiedSourceId(feature: ProcessedFeature, sourceId: string): string {
  const facility = feature.properties.sourceFacility;
  const floor = feature.properties.sourceFloor;
  return typeof facility === 'string' && typeof floor === 'string' ? `${facility}:${floor}:${sourceId}` : sourceId;
}

export function buildGraphFromProcessedData(dataset: ProcessedDataset): RoutingGraph {
  const nodes = dataset.features
    .filter((feature) => feature.layer === 'TWSI_Point' && feature.geometry.type === 'Point')
    .map<GraphNode>((feature) => {
      const [x, y, z] = feature.geometry.type === 'Point' ? feature.geometry.coordinates : [0, 0, 0];
      return {
        id: qualifiedSourceId(feature, feature.sourceId),
        sourceId: feature.sourceId,
        name: optionalName(feature.properties.name),
        x,
        y,
        z,
        floorId: feature.floorId ?? dataset.source.floorId,
        facilityId: typeof feature.properties.sourceFacility === 'string' ? feature.properties.sourceFacility : dataset.source.facilityId,
        kind: categoryToNodeKind(feature.properties.category),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const rejectedEdges: RejectedGraphEdge[] = [];
  const edges = dataset.features
    .filter((feature) => feature.layer === 'TWSI_Line')
    .map<GraphEdge | null>((feature) => {
      const rawStart = feature.properties.startnode;
      const rawEnd = feature.properties.endnode;
      const from = typeof rawStart === 'string' ? qualifiedSourceId(feature, rawStart) : undefined;
      const to = typeof rawEnd === 'string' ? qualifiedSourceId(feature, rawEnd) : undefined;
      const geometry = linePoints(feature);
      const hasStart = from !== undefined && nodeIds.has(from);
      const hasEnd = to !== undefined && nodeIds.has(to);
      if (geometry.length < 2) {
        rejectedEdges.push({ sourceId: feature.sourceId, reason: 'malformed-geometry', startNode: from, endNode: to });
        return null;
      }
      if (!hasStart || !hasEnd || !from || !to) {
        rejectedEdges.push({ sourceId: feature.sourceId, reason: referenceReason(hasStart, hasEnd), startNode: from, endNode: to });
        return null;
      }
      return {
        id: qualifiedSourceId(feature, feature.sourceId),
        sourceId: feature.sourceId,
        from,
        to,
        distanceMeters: distance3d(geometry),
        direction: 'both',
        kind: 'corridor',
        accessibility: 'unknown',
        floorFrom: feature.floorId ?? dataset.source.floorId,
        floorTo: feature.floorId ?? dataset.source.floorId,
        geometry,
      };
    })
    .filter((edge): edge is GraphEdge => edge !== null)
    .sort((a, b) => a.id.localeCompare(b.id));
  const adjacency: Record<string, GraphEdge[]> = Object.fromEntries(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    adjacency[edge.from]?.push(edge);
    adjacency[edge.to]?.push({ ...edge, id: `${edge.id}:reverse`, from: edge.to, to: edge.from, geometry: [...edge.geometry].reverse() });
  }
  for (const list of Object.values(adjacency)) list.sort((a, b) => a.to.localeCompare(b.to) || a.id.localeCompare(b.id));
  rejectedEdges.sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  return { nodes, edges, adjacency, rejectedEdges };
}
