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

type NamedPlacesFixture = {
  places: Array<{
    name: string;
    routable: boolean;
    access: {
      confidence: 'high' | 'medium' | 'low';
      reviewStatus: 'automatic' | 'reviewed';
      componentId: number;
    };
  }>;
  statistics: {
    placeCount: number;
    routablePlaceCount: number;
    uniqueNameCount: number;
    attachmentConfidenceCounts: Record<string, number>;
    componentCounts: Record<string, number>;
  };
};

function namedPlacesFixture(): NamedPlacesFixture {
  return copy(placesValue) as NamedPlacesFixture;
}

function synchronizePlaceStatistics(dataset: NamedPlacesFixture): void {
  const attachmentConfidenceCounts = { high: 0, medium: 0, low: 0 };
  const componentCounts: Record<string, number> = {};
  for (const place of dataset.places) {
    attachmentConfidenceCounts[place.access.confidence] += 1;
    const componentId = String(place.access.componentId);
    componentCounts[componentId] = (componentCounts[componentId] ?? 0) + 1;
  }
  dataset.statistics = {
    placeCount: dataset.places.length,
    routablePlaceCount: dataset.places.filter(({ routable }) => routable).length,
    uniqueNameCount: new Set(dataset.places.map(({ name }) => name)).size,
    attachmentConfidenceCounts,
    componentCounts,
  };
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

  it('rejects routable automatic low-confidence attachments but permits non-routable and reviewed low attachments', () => {
    const network = parseOfficialNetwork(networkValue);
    const reviewedNetwork = parseReviewedCustomNetwork(reviewedNetworkValue, network);

    const automaticRoutable = namedPlacesFixture();
    automaticRoutable.places[0].access.confidence = 'low';
    automaticRoutable.places[0].access.reviewStatus = 'automatic';
    automaticRoutable.places[0].routable = true;
    synchronizePlaceStatistics(automaticRoutable);
    expect(() => parseNamedPlaces(automaticRoutable, network, reviewedNetwork)).toThrow(/automatic low-confidence.*routable/i);

    const automaticNonRoutable = namedPlacesFixture();
    automaticNonRoutable.places[0].access.confidence = 'low';
    automaticNonRoutable.places[0].access.reviewStatus = 'automatic';
    automaticNonRoutable.places[0].routable = false;
    synchronizePlaceStatistics(automaticNonRoutable);
    expect(parseNamedPlaces(automaticNonRoutable, network, reviewedNetwork).places[0].routable).toBe(false);

    // docs/DATA_MODEL.md states that low-confidence attachments are excluded until reviewed.
    const reviewedRoutable = namedPlacesFixture();
    reviewedRoutable.places[0].access.confidence = 'low';
    reviewedRoutable.places[0].access.reviewStatus = 'reviewed';
    reviewedRoutable.places[0].routable = true;
    synchronizePlaceStatistics(reviewedRoutable);
    expect(parseNamedPlaces(reviewedRoutable, network, reviewedNetwork).places[0].routable).toBe(true);
  });

  it('rejects mismatched named-place statistics and invalid count-record keys or values', () => {
    const network = parseOfficialNetwork(networkValue);
    const reviewedNetwork = parseReviewedCustomNetwork(reviewedNetworkValue, network);
    const expectRejected = (mutate: (dataset: NamedPlacesFixture) => void) => {
      const dataset = namedPlacesFixture();
      mutate(dataset);
      expect(() => parseNamedPlaces(dataset, network, reviewedNetwork)).toThrow();
    };

    expectRejected((dataset) => { dataset.statistics.placeCount += 1; });
    expectRejected((dataset) => { dataset.statistics.routablePlaceCount += 1; });
    expectRejected((dataset) => { dataset.statistics.uniqueNameCount += 1; });
    expectRejected((dataset) => { dataset.statistics.attachmentConfidenceCounts.high -= 1; });
    expectRejected((dataset) => { dataset.statistics.componentCounts['0'] -= 1; });
    expectRejected((dataset) => { delete dataset.statistics.attachmentConfidenceCounts.low; });
    expectRejected((dataset) => { dataset.statistics.attachmentConfidenceCounts.unexpected = 0; });
    expectRejected((dataset) => { dataset.statistics.attachmentConfidenceCounts.medium = -1; });
    expectRejected((dataset) => { delete dataset.statistics.componentCounts['0']; });
    expectRejected((dataset) => { dataset.statistics.componentCounts.unexpected = 0; });
    expectRejected((dataset) => { dataset.statistics.componentCounts['0'] = -1; });
  });
});
