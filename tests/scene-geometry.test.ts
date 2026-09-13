import { describe, expect, it } from 'vitest';
import { createExtrudedGeometry, emphasizedSpaceSegments, featureSegments, graphContextSegments, graphSegments, highlightedPolylines, outdoorFeatureSegments, sceneCenter } from '../src/map/sceneGeometry';
import type { RoutingGraph } from '../src/graph/types';
import type { ProcessedDataset, ProcessedFeature } from '../src/types/processed';

function polygon(id: string, layer: ProcessedFeature['layer'], floorId = 'B1', properties: Record<string, unknown> = {}): ProcessedFeature {
  return { id, sourceId: id, sourceRecord: 1, layer, floorId, geometry: { type: 'Polygon', parts: [[[0, -5, 0], [2, -5, 0], [2, -5, 2], [0, -5, 0]]] }, properties };
}

const graph: RoutingGraph = {
  nodes: [
    { id: 'inside-a', x: 0, y: -5, z: 0, floorId: 'B1', facilityId: 'station', kind: 'normal', inOut: 'inside' },
    { id: 'inside-b', x: 2, y: -5, z: 0, floorId: 'B1', facilityId: 'station', kind: 'normal', inOut: 'inside' },
    { id: 'boundary', x: 4, y: -5, z: 0, floorId: 'B1', facilityId: 'station', kind: 'normal', inOut: 'boundary' },
    { id: 'outside', x: 6, y: -5, z: 0, floorId: 'B1', facilityId: 'station', kind: 'normal', inOut: 'outside' },
  ],
  edges: [
    { id: 'inside', from: 'inside-a', to: 'inside-b', sourceId: 'inside', distanceMeters: 2, direction: 'both', kind: 'corridor', accessibility: 'yes', floorFrom: 'B1', floorTo: 'B1', geometry: [[0, -5, 0], [2, -5, 0]] },
    { id: 'boundary', from: 'inside-b', to: 'boundary', sourceId: 'boundary', distanceMeters: 2, direction: 'both', kind: 'corridor', accessibility: 'yes', floorFrom: 'B1', floorTo: 'B1', geometry: [[2, -5, 0], [4, -5, 0]] },
    { id: 'outside', from: 'boundary', to: 'outside', sourceId: 'outside', distanceMeters: 2, direction: 'both', kind: 'corridor', accessibility: 'yes', floorFrom: 'B1', floorTo: 'B1', geometry: [[4, -5, 0], [6, -5, 0]] },
  ],
  adjacency: {},
  rejectedEdges: [],
};

describe('scene geometry selection', () => {
  it('centers the dataset and selects only requested, renderable feature segments', () => {
    const dataset = { statistics: { bounds: { minX: -4, maxX: 8, minY: -5, maxY: 0, minZ: -2, maxZ: 6 } } } as ProcessedDataset;
    const features = [polygon('floor', 'Floor'), polygon('other-floor', 'Floor', '0'), { ...polygon('point', 'Floor'), geometry: { type: 'Point' as const, coordinates: [0, -5, 0] as [number, number, number] } }];
    expect(sceneCenter(dataset)).toEqual([-2, 0, -2]);
    expect(featureSegments(features, 'Floor', ['B1'], true)).toEqual([[[0, -30, 0], [2, -30, 0]], [[2, -30, 0], [2, -30, 2]], [[2, -30, 2], [0, -30, 0]]]);
  });

  it('preserves emphasis and outdoor selection while returning caller-owned extruded geometry', () => {
    const features = [polygon('stairs', 'Space', 'B1', { category: 'B021' }), polygon('restricted', 'Space', 'B1', { category: 'B026' }), polygon('outdoor', 'Opening', 'B1', { sourceFloor: '2OUT' })];
    expect(emphasizedSpaceSegments(features, 'vertical', ['B1'], false)).toHaveLength(3);
    expect(emphasizedSpaceSegments(features, 'restricted', ['B1'], false)).toHaveLength(3);
    expect(outdoorFeatureSegments(features, ['B1'], false)).toHaveLength(3);

    const geometry = createExtrudedGeometry([polygon('floor', 'Floor')], 'Floor', ['B1'], false);
    expect(geometry?.getAttribute('position').count).toBeGreaterThan(0);
    let disposed = false;
    geometry?.addEventListener('dispose', () => { disposed = true; });
    geometry?.dispose();
    expect(disposed).toBe(true);
  });

  it('keeps graph context, floor filtering, and highlighted route selection deterministic', () => {
    expect(graphSegments(graph, ['B1'], true)).toHaveLength(3);
    expect(graphContextSegments(graph, ['B1'], false)).toMatchObject({ inside: [[[0, -5, 0], [2, -5, 0]]], boundary: [[[2, -5, 0], [4, -5, 0]]], outside: [[[4, -5, 0], [6, -5, 0]]] });
    expect(highlightedPolylines(graph, ['outside', 'inside'], ['B1'], true)).toEqual([[[0, -30, 0], [2, -30, 0]], [[4, -30, 0], [6, -30, 0]]]);
    expect(highlightedPolylines(graph, ['inside'], ['0'], false)).toEqual([]);
  });
});
