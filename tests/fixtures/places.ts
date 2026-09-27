import type { NamedPlaceRecord } from '../../src/schema/processed';

export const places: NamedPlaceRecord[] = [
  { id: 'start', sourceId: 's', sourceFacility: 'JR', sourceFile: 'a', sourceRecord: 1, name: 'Start gate', category: 'gate', floorId: 'B1', coordinates: [0, 0, 0], routable: true, access: { nodeId: 'n1', distanceMeters: 1, confidence: 'high', reviewStatus: 'automatic', accessibility: 'unknown', componentId: 0, geometry: [[0, 0, 0], [1, 0, 0]] } },
  { id: 'end', sourceId: 'e', sourceFacility: 'JR', sourceFile: 'b', sourceRecord: 2, name: 'End gate', category: 'gate', floorId: 'B1', coordinates: [2, 0, 0], routable: true, access: { nodeId: 'n2', distanceMeters: 1, confidence: 'high', reviewStatus: 'automatic', accessibility: 'unknown', componentId: 0, geometry: [[2, 0, 0], [1, 0, 0]] } },
  { id: 'metro', sourceId: 'm', sourceFacility: 'Metro east area', sourceFile: 'c', sourceRecord: 3, name: 'Metro gate', category: 'gate', floorId: 'B2', coordinates: [4, -10, 0], routable: true, access: { nodeId: 'n3', distanceMeters: 1, confidence: 'high', reviewStatus: 'automatic', accessibility: 'unknown', componentId: 0, geometry: [[4, -10, 0], [3, -10, 0]] } },
  { id: 'toilet', sourceId: 't', sourceFacility: 'JR', sourceFile: 'd', sourceRecord: 4, name: 'East toilet', category: 'toilet', floorId: 'B1', coordinates: [5, 0, 0], routable: true, access: { nodeId: 'n4', distanceMeters: 1, confidence: 'high', reviewStatus: 'reviewed', accessibility: 'yes', componentId: 0, geometry: [[5, 0, 0], [4, 0, 0]] } },
];
