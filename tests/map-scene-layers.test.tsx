import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MapScene, type MapSceneProps } from '../src/map/MapScene.js';
import { featureSegments, graphContextSegments, graphSegments } from '../src/map/sceneGeometry.js';
import { networkDirectionArrows } from '../src/map/networkDirectionGeometry.js';
import { allSourceLinkSegments } from '../src/map/debugNetwork.js';
import { parseFloorDataset, parseOfficialNetwork } from '../src/schema/processed.js';
import { buildOfficialGraph } from '../src/graph/buildOfficialGraph.js';

vi.mock('../src/map/sceneGeometry.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/map/sceneGeometry.js')>();
  return { ...original, featureSegments: vi.fn(original.featureSegments), graphContextSegments: vi.fn(original.graphContextSegments), graphSegments: vi.fn(original.graphSegments) };
});
vi.mock('../src/map/networkDirectionGeometry.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/map/networkDirectionGeometry.js')>();
  return { ...original, networkDirectionArrows: vi.fn(original.networkDirectionArrows) };
});
vi.mock('../src/map/debugNetwork.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/map/debugNetwork.js')>();
  return { ...original, allSourceLinkSegments: vi.fn(original.allSourceLinkSegments) };
});
vi.mock('../src/map/sceneLayers.js', () => ({ ExtrudedLayer: () => null, SemanticFixtureLayer: () => null, SemanticSpaceLayer: () => null }));
vi.mock('../src/map/sceneLinePrimitives.js', () => ({ NetworkDirectionArrows: () => null, RouteLines: () => null, Segments: () => null, StructuralOverlay: () => null, WideSegments: () => null }));
vi.mock('../src/map/sceneMarkerLayers.js', () => ({ FacilityMarkerLayer: () => null, PlaceLayer: () => null }));

const network = parseOfficialNetwork(JSON.parse(readFileSync('public/data/processed/jr-shinjuku-ticket-gates-b1-official-network.json', 'utf8')) as unknown);
const graph = buildOfficialGraph(network);
const props: MapSceneProps = {
  activeFloor: 'B1', floorViewMode: 'stack', routeFloorIds: [], facilityMarkerCandidates: [],
  floor: parseFloorDataset(JSON.parse(readFileSync('public/data/processed/shinjuku-full-map.json', 'utf8')) as unknown),
  officialNetwork: network, routingGraph: graph, twsiGraph: graph, places: [], route: { status: 'invalid-place', placeId: '', reason: 'not-found' },
  startId: '', destinationId: '', highlightedRouteEdgeIds: [], debug: false, showAllSourceLinks: false, showOfficialNetwork: false,
  showOfficialNodes: false, showTwsi: false, showFacilities: false, enabledFacilityCategories: new Set(), showGateLabels: false,
  showStructuralDetails: false, visibleFloors: ['B1'], onFacilityRouteAction: () => undefined,
};

beforeEach(() => vi.clearAllMocks());

function expectNoOptionalGeometry() {
  expect(graphContextSegments).not.toHaveBeenCalled();
  expect(networkDirectionArrows).not.toHaveBeenCalled();
  expect(allSourceLinkSegments).not.toHaveBeenCalled();
  expect(graphSegments).not.toHaveBeenCalled();
  expect(vi.mocked(featureSegments).mock.calls.filter(([, layer]) => layer === 'Drawing')).toEqual([]);
}

describe('optional scene layers', () => {
  it('does not prepare hidden geometry, including debug-only toggles outside debug mode', () => {
    renderToStaticMarkup(<MapScene {...props} />);
    expectNoOptionalGeometry();
    renderToStaticMarkup(<MapScene {...props} showAllSourceLinks showTwsi />);
    expectNoOptionalGeometry();
  });

  it('prepares visible geometry with the selected floors and display elevation mode', () => {
    const floors = ['B1', '0'];
    renderToStaticMarkup(<MapScene {...props} visibleFloors={floors} debug showOfficialNetwork showAllSourceLinks showTwsi showStructuralDetails />);
    expect(graphContextSegments).toHaveBeenCalledExactlyOnceWith(graph, floors, true);
    expect(networkDirectionArrows).toHaveBeenCalledExactlyOnceWith(graph.edges, floors, true);
    expect(allSourceLinkSegments).toHaveBeenCalledExactlyOnceWith(network, floors, true);
    expect(graphSegments).toHaveBeenCalledExactlyOnceWith(graph, floors, true);
    expect(vi.mocked(featureSegments).mock.calls.filter(([, layer]) => layer === 'Drawing')).toHaveLength(2);
  });
});
