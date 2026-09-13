import { BufferGeometry, ExtrudeGeometry, Shape } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { RoutingGraph } from '../graph/types.js';
import type { ProcessedDataset, ProcessedFeature } from '../types/processed.js';
import { classifyNetworkEdgeContext } from './networkContext.js';
import { displayElevation, displayPoint } from './stackedElevation.js';
import { spacePresentationStyle, type SpacePresentationStyle } from './spacePresentation.js';
import { FLOOR_SKIRT_HEIGHT_METERS, FLOOR_SKIRT_OFFSET_METERS } from './floorRendering.js';

export type ScenePoint3 = [number, number, number];
export type SceneSegment = [ScenePoint3, ScenePoint3];

const DISPLAY_HEIGHTS: Partial<Record<ProcessedFeature['layer'], { height: number; offset: number }>> = {
  Floor: { height: FLOOR_SKIRT_HEIGHT_METERS, offset: FLOOR_SKIRT_OFFSET_METERS },
  Space: { height: 0.18, offset: 0.3 },
};

export function sceneCenter(dataset: ProcessedDataset): ScenePoint3 {
  const { minX, maxX, minZ, maxZ } = dataset.statistics.bounds;
  return [-(minX + maxX) / 2, 0, -(minZ + maxZ) / 2];
}

export function featureSegments(features: ProcessedFeature[], layer: ProcessedFeature['layer'], floors: string[], stacked: boolean): SceneSegment[] {
  return features.filter((feature) => floors.includes(feature.floorId ?? 'B1') && feature.layer === layer && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'PolyLine')).flatMap((feature) => feature.geometry.type === 'Point' ? [] : feature.geometry.parts.flatMap((part) => part.slice(1).map((point, index) => [displayPoint(part[index], stacked), displayPoint(point, stacked)] as SceneSegment)));
}

/** The caller owns and must dispose the returned geometry. */
export function createExtrudedGeometry(features: ProcessedFeature[], layer: 'Floor' | 'Space' | 'Fixture', floors: string[], stacked: boolean, style = DISPLAY_HEIGHTS[layer]!): BufferGeometry | undefined {
  const geometries = features.filter((feature) => feature.layer === layer && floors.includes(feature.floorId ?? 'B1') && feature.geometry.type === 'Polygon').flatMap((feature) => feature.geometry.type !== 'Polygon' ? [] : feature.geometry.parts.flatMap((part) => {
    if (part.length < 3) return [];
    const shape = new Shape();
    shape.moveTo(part[0][0], -part[0][2]);
    for (const point of part.slice(1)) shape.lineTo(point[0], -point[2]);
    const geometry = new ExtrudeGeometry(shape, { depth: style.height, bevelEnabled: false, curveSegments: 1, steps: 1 });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, displayElevation(part[0][1], stacked) + style.offset, 0);
    return [geometry];
  }));
  if (geometries.length === 0) return undefined;
  const merged = mergeGeometries(geometries, false) ?? undefined;
  geometries.forEach((geometry) => geometry.dispose());
  merged?.computeVertexNormals();
  return merged;
}

export function emphasizedSpaceSegments(features: ProcessedFeature[], emphasis: SpacePresentationStyle['emphasis'], floors: string[], stacked: boolean): SceneSegment[] {
  return featureSegments(features.filter((feature) => feature.layer === 'Space' && spacePresentationStyle(feature.properties.category).emphasis === emphasis), 'Space', floors, stacked);
}

export function graphSegments(graph: RoutingGraph, floors: string[], stacked: boolean): SceneSegment[] {
  return graph.edges.filter((edge) => floors.includes(edge.floorFrom) && floors.includes(edge.floorTo)).flatMap((edge) => edge.geometry.slice(1).map((point, index) => [displayPoint(edge.geometry[index], stacked), displayPoint(point, stacked)] as SceneSegment));
}

export function graphContextSegments(graph: RoutingGraph, floors: string[], stacked: boolean): Record<'inside' | 'boundary' | 'outside', SceneSegment[]> {
  const result = { inside: [] as SceneSegment[], boundary: [] as SceneSegment[], outside: [] as SceneSegment[] };
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const edge of graph.edges) {
    if (!floors.includes(edge.floorFrom) || !floors.includes(edge.floorTo)) continue;
    const context = classifyNetworkEdgeContext(edge, nodes);
    result[context].push(...edge.geometry.slice(1).map((point, index) => [displayPoint(edge.geometry[index], stacked), displayPoint(point, stacked)] as SceneSegment));
  }
  return result;
}

function outdoorFeature(feature: ProcessedFeature): boolean {
  return typeof feature.properties.sourceFloor === 'string' && feature.properties.sourceFloor.toLowerCase().endsWith('out');
}

export function outdoorFeatureSegments(features: ProcessedFeature[], floors: string[], stacked: boolean): SceneSegment[] {
  const outdoorFeatures = features.filter(outdoorFeature);
  return ['Floor', 'Space', 'Fixture', 'Opening'].flatMap((layer) => featureSegments(outdoorFeatures, layer as ProcessedFeature['layer'], floors, stacked));
}

export function highlightedPolylines(graph: RoutingGraph, edgeIds: string[], floors: string[], stacked: boolean): ScenePoint3[][] {
  if (edgeIds.length === 0) return [];
  const selected = new Set(edgeIds);
  return graph.edges.filter((edge) => selected.has(edge.id) && floors.includes(edge.floorFrom) && floors.includes(edge.floorTo)).map((edge) => edge.geometry.map((point) => displayPoint(point, stacked)));
}
