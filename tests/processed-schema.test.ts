import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFloorDataset, parseNamedPlaces, parseOfficialNetwork } from '../src/schema/processed';
import { parseReviewedCustomNetwork } from '../src/schema/reviewedCustomNetwork';

const networkValue: unknown = JSON.parse(readFileSync('public/data/processed/jr-shinjuku-ticket-gates-b1-official-network.json', 'utf8'));
const placesValue: unknown = JSON.parse(readFileSync('public/data/processed/shinjuku-b1-named-places.json', 'utf8'));
const floorValue: unknown = JSON.parse(readFileSync('public/data/processed/shinjuku-full-map.json', 'utf8'));
const reviewedNetworkValue: unknown = JSON.parse(readFileSync('public/data/processed/shinjuku-reviewed-custom-network.json', 'utf8'));

function copy<T>(value: T): T {
  return structuredClone(value);
}

describe('processed data runtime schemas', () => {
  it('accepts the checked-in network and place datasets', () => {
    const network = parseOfficialNetwork(networkValue);
    const reviewedNetwork = parseReviewedCustomNetwork(reviewedNetworkValue, network);
    expect(parseFloorDataset(floorValue).features.length).toBeGreaterThan(0);
    expect(parseNamedPlaces(placesValue, network, reviewedNetwork).places.length).toBeGreaterThan(0);
  });

  it('rejects malformed floor geometry and metadata before rendering', () => {
    const invalidGeometry = copy(floorValue) as { features: Array<{ geometry: { type: string; parts: unknown[] } }> };
    invalidGeometry.features[0].geometry = { type: 'Polygon', parts: [[['not-a-number', 0, 0]]] };
    expect(() => parseFloorDataset(invalidGeometry)).toThrow(/too short|finite number/);

    const invalidLayer = copy(floorValue) as { features: Array<{ layer: string }> };
    invalidLayer.features[0].layer = 'InventedLayer';
    expect(() => parseFloorDataset(invalidLayer)).toThrow('unsupported value');

    const invalidFacility = copy(floorValue) as { features: Array<{ layer: string; geometry: { type: string; coordinates?: unknown; parts?: unknown[] }; properties: Record<string, unknown> }> };
    const facility = invalidFacility.features.find(({ layer }) => layer === 'Facility');
    expect(facility).toBeDefined();
    facility!.geometry = { type: 'PolyLine', parts: [[[0, 0, 0], [1, 0, 1]]] };
    expect(() => parseFloorDataset(invalidFacility)).toThrow(/Facility feature .* must use Point geometry/);

    const missingFacilityCategory = copy(floorValue) as { features: Array<{ layer: string; properties: Record<string, unknown> }> };
    const categoryless = missingFacilityCategory.features.find(({ layer }) => layer === 'Facility');
    expect(categoryless).toBeDefined();
    delete categoryless!.properties.category;
    expect(() => parseFloorDataset(missingFacilityCategory)).toThrow(/Facility feature .*properties.category must be a non-empty string/);
  });

  it('rejects inconsistent place floors, access geometry, and accessibility metadata', () => {
    const network = parseOfficialNetwork(networkValue);
    const reviewedNetwork = parseReviewedCustomNetwork(reviewedNetworkValue, network);
    const wrongFloor = copy(placesValue) as { places: Array<{ floorId: string }> };
    wrongFloor.places[0].floorId = 'missing-floor';
    expect(() => parseNamedPlaces(wrongFloor, network, reviewedNetwork)).toThrow('different floors');

    const wrongAccess = copy(placesValue) as { places: Array<{ access: { geometry: Array<[number, number, number]> } }> };
    wrongAccess.places[0].access.geometry[0][0] += 1;
    expect(() => parseNamedPlaces(wrongAccess, network, reviewedNetwork)).toThrow('must start at the place coordinate');

    const missingAccessibility = copy(placesValue) as { places: Array<{ access: { accessibility?: string } }> };
    delete missingAccessibility.places[0].access.accessibility;
    expect(() => parseNamedPlaces(missingAccessibility, network, reviewedNetwork)).toThrow('accessibility has unsupported value');
  });

  it('rejects unsupported versions before application code sees the data', () => {
    const invalid = copy(networkValue) as Record<string, unknown>;
    invalid.schemaVersion = 2;
    expect(() => parseOfficialNetwork(invalid)).toThrow('Unsupported official-network schemaVersion 2');
  });

  it('rejects broken network and place references', () => {
    const invalidNetwork = copy(networkValue) as { edges: Array<{ from: string }> };
    invalidNetwork.edges[0].from = 'missing-node';
    expect(() => parseOfficialNetwork(invalidNetwork)).toThrow('invalid node reference');

    const network = parseOfficialNetwork(networkValue);
    const reviewedNetwork = parseReviewedCustomNetwork(reviewedNetworkValue, network);
    const invalidPlaces = copy(placesValue) as { places: Array<{ access: { nodeId: string } }> };
    invalidPlaces.places[0].access.nodeId = 'missing-node';
    expect(() => parseNamedPlaces(invalidPlaces, network, reviewedNetwork)).toThrow('refers to missing node');
  });
});
