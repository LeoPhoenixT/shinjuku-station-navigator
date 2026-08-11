import { describe, expect, it } from 'vitest';
import type { GraphEdge, RoutingGraph } from '../src/graph/types';
import { buildRouteInstructions, STRAIGHT_ANGLE_THRESHOLD_DEGREES } from '../src/routing/routeInstructions';
import { formatRouteInstruction } from '../src/i18n/formatters';
import type { NamedPlaceRecord } from '../src/schema/processed';

function place(id: string, name: string, floorId: string, nodeId: string, access: number): NamedPlaceRecord {
  return { id, sourceId: id, sourceFacility: 'fixture', sourceFile: 'fixture', sourceRecord: 0, name, category: 'gate', floorId, coordinates: [0, 0, 0], routable: true, access: { nodeId, distanceMeters: access, confidence: 'high', reviewStatus: 'automatic', accessibility: 'unknown', componentId: 0, geometry: [[0, 0, 0], [0, 0, 0]] } };
}

function graph(): RoutingGraph {
  const nodes = [
    { id: 'a', x: 0, y: 0, z: 0, floorId: 'B1', facilityId: 'fixture', kind: 'normal' as const },
    { id: 'b', x: 5, y: 0, z: 0, floorId: 'B1', facilityId: 'fixture', kind: 'normal' as const },
    { id: 'c', x: 10, y: 0, z: 1, floorId: 'B1', facilityId: 'fixture', kind: 'normal' as const },
    { id: 'd', x: 10, y: 0, z: 6, floorId: 'B1', facilityId: 'fixture', kind: 'normal' as const },
    { id: 'e', x: 10, y: 4, z: 6, floorId: '0', facilityId: 'fixture', kind: 'elevator' as const },
  ];
  const edges: GraphEdge[] = [
    { id: 'ab', from: 'a', to: 'b', distanceMeters: 5, direction: 'forward', kind: 'corridor', accessibility: 'yes', floorFrom: 'B1', floorTo: 'B1', geometry: [[0, 0, 0], [5, 0, 0]] },
    { id: 'bc', from: 'b', to: 'c', distanceMeters: 5.1, direction: 'forward', kind: 'corridor', accessibility: 'yes', floorFrom: 'B1', floorTo: 'B1', geometry: [[5, 0, 0], [10, 0, 1]] },
    { id: 'cd', from: 'c', to: 'd', distanceMeters: 5, direction: 'forward', kind: 'corridor', accessibility: 'yes', floorFrom: 'B1', floorTo: 'B1', geometry: [[10, 0, 1], [10, 0, 6]] },
    { id: 'de', from: 'd', to: 'e', distanceMeters: 4, direction: 'forward', kind: 'elevator', accessibility: 'yes', floorFrom: 'B1', floorTo: '0', geometry: [[10, 0, 6], [10, 4, 6]] },
  ];
  return { nodes, edges, rejectedEdges: [], adjacency: { a: [edges[0]], b: [edges[1]], c: [edges[2]], d: [edges[3]], e: [] } };
}

describe('Phase 9 route instructions', () => {
  it('combines near-collinear edges, announces turns, and names floor transitions', () => {
    const steps = buildRouteInstructions(graph(), { nodeIds: ['a', 'b', 'c', 'd', 'e'], edgeIds: ['ab', 'bc', 'cd', 'de'], distanceMeters: 19.1, totalCost: 19.1 }, place('start', 'Start gate', 'B1', 'a', 1.2), place('end', 'Exit', '0', 'e', 2.4));
    expect(STRAIGHT_ANGLE_THRESHOLD_DEGREES).toBe(20);
    expect(steps.map(({ kind }) => kind)).toEqual(['access', 'continue', 'turn-right', 'transition', 'arrive']);
    expect(steps[1].edgeIds).toEqual(['ab', 'bc']);
    expect(formatRouteInstruction(steps[2], place('start', 'Start gate', 'B1', 'a', 1.2), place('end', 'Exit', '0', 'e', 2.4), 'en')).toContain('Turn right');
    expect(formatRouteInstruction(steps[3], place('start', 'Start gate', 'B1', 'a', 1.2), place('end', 'Exit', '0', 'e', 2.4), 'en')).toBe('Take the elevator from B1 to Ground for 4.0 m.');
    expect(formatRouteInstruction(steps.at(-1)!, place('start', 'Start gate', 'B1', 'a', 1.2), place('end', 'Exit', '0', 'e', 2.4), 'en')).toContain('Exit');
    expect(formatRouteInstruction(steps[3], place('start', 'Start gate', 'B1', 'a', 1.2), place('end', 'Exit', '0', 'e', 2.4), 'ja')).toBe('エレベーターで地下1階から地上階へ移動します（4.0 m）。');
  });
});
