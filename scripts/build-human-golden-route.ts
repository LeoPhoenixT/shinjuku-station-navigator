import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildOfficialGraph } from '../src/graph/buildOfficialGraph.js';
import { mergeReviewedCustomGraph } from '../src/graph/buildReviewedCustomGraph.js';
import { planRoute } from '../src/routing/routeService.js';
import { parseNamedPlaces, parseOfficialNetwork } from '../src/schema/processed.js';
import { parseReviewedCustomNetwork } from '../src/schema/reviewedCustomNetwork.js';
import { isMainModule } from './data/is-main-module.js';

const NETWORK = 'public/data/processed/jr-shinjuku-ticket-gates-b1-official-network.json';
const PLACES = 'public/data/processed/shinjuku-b1-named-places.json';
const OUTPUT = 'reports/human-golden-route.json';
const REVIEWED_NETWORK = 'public/data/processed/shinjuku-reviewed-custom-network.json';
const START_PLACE_ID = 'gate:b9bd2f7edf4e444994e061cdd552af2a';
const END_PLACE_ID = 'gate:a628691805db44e2b65d427271a8bc24';
const EXPANDED_PLACE_ID = 'gate:7be0b976ae3546a79da40da5ec159516';
const FACILITY_PLACE_IDS = [
  'facility:phase7b:14.バスタ新宿/3/Basuta_3_Facility:16ead878a34c4883b9d47273f985b1c1',
  'facility:phase7b:14.バスタ新宿/4/Basuta_4_Facility:7d52f21da4834a8294cbde9525a7571c',
  'facility:phase7b:14.バスタ新宿/4/Basuta_4_Facility:46ff30501f984f5fa2193628a6430252',
] as const;

export interface HumanGoldenRouteReport {
  generatedAt: string;
  algorithm: 'astar';
  profile: 'shortest';
  start: { placeId: string; name: string; sourceFacility: string; nodeId: string; attachmentDistanceMeters: number; attachmentConfidence: string };
  destination: { placeId: string; name: string; sourceFacility: string; nodeId: string; attachmentDistanceMeters: number; attachmentConfidence: string };
  route: { nodeIds: string[]; edgeIds: string[]; networkDistanceMeters: number; accessDistanceMeters: number; totalJourneyDistanceMeters: number };
  expandedCoverageFixture: { fromPlaceId: string; fromName: string; toPlaceId: string; toName: string; networkDistanceMeters: number };
  multiFloorFixture: { fromPlaceId: string; toPlaceId: string; floors: string[]; connectorEdgeIds: string[]; connectorKinds: Array<'elevator' | 'escalator' | 'stairs'>; networkDistanceMeters: number };
  facilityFixtures: Array<{ placeId: string; name: string; category: string; sourceCategoryCode: string; floorId: string; attachmentDistanceMeters: number; totalJourneyDistanceMeters: number }>;
}

export function buildHumanGoldenRoute(networkInput = NETWORK, placesInput = PLACES, output = OUTPUT, reviewedNetworkInput = REVIEWED_NETWORK): HumanGoldenRouteReport {
  const network = parseOfficialNetwork(JSON.parse(readFileSync(networkInput, 'utf8')));
  const reviewedNetwork = parseReviewedCustomNetwork(JSON.parse(readFileSync(reviewedNetworkInput, 'utf8')), network);
  const places = parseNamedPlaces(JSON.parse(readFileSync(placesInput, 'utf8')), network, reviewedNetwork);
  const start = places.places.find(({ id }) => id === START_PLACE_ID);
  const destination = places.places.find(({ id }) => id === END_PLACE_ID);
  const expandedDestination = places.places.find(({ id }) => id === EXPANDED_PLACE_ID);
  if (!start || !destination || !expandedDestination) throw new Error('Golden-route places are missing from the normalized place dataset.');
  const graph = mergeReviewedCustomGraph(buildOfficialGraph(network), reviewedNetwork);
  const planned = planRoute(network, graph, places.places, start.id, destination.id);
  if (planned.status !== 'ok') throw new Error(`No supported official-network route from ${start.name} to ${destination.name}: ${planned.status}.`);
  const expandedCoverage = planRoute(network, graph, places.places, start.id, expandedDestination.id);
  if (expandedCoverage.status !== 'ok') throw new Error(`Expected a route unlocked by full-source coverage, received ${expandedCoverage.status}.`);
  const ground = places.places.find(({ category, floorId }) => category === 'connector' && floorId === '0');
  if (!ground) throw new Error('Ground-floor connector place is missing.');
  const multiFloorStart = places.places.filter((place) => place.floorId === 'B1' && place.routable && place.access.componentId === ground.access.componentId).sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!multiFloorStart) throw new Error('No routed B1 place shares the ground connector component.');
  const multiFloor = planRoute(network, graph, places.places, multiFloorStart.id, ground.id);
  if (multiFloor.status !== 'ok') throw new Error(`Multi-floor golden route failed: ${multiFloor.status}.`);
  const sourceEdges = new Map(network.edges.map((edge) => [edge.id, edge]));
  const connectorEdges = multiFloor.network.edgeIds.map((id) => sourceEdges.get(id.replace(/:reverse$/, ''))).filter((edge) => edge && edge.floorFrom !== edge.floorTo);
  if (connectorEdges.length === 0) throw new Error('Multi-floor golden route contains no vertical connector.');
  const facilityFixtures = FACILITY_PLACE_IDS.map((placeId) => {
    const place = places.places.find(({ id }) => id === placeId);
    if (!place) throw new Error(`Facility golden-route place ${placeId} is missing.`);
    if (!place.sourceCategoryCode) throw new Error(`Facility golden-route place ${placeId} has no source category.`);
    const route = planRoute(network, graph, places.places, start.id, place.id);
    if (route.status !== 'ok') throw new Error(`Facility golden route to ${place.name} failed: ${route.status}.`);
    return { placeId: place.id, name: place.name, category: place.category, sourceCategoryCode: place.sourceCategoryCode, floorId: place.floorId, attachmentDistanceMeters: place.access.distanceMeters, totalJourneyDistanceMeters: route.totalDistanceMeters };
  });
  const report: HumanGoldenRouteReport = {
    generatedAt: new Date(0).toISOString(),
    algorithm: 'astar',
    profile: 'shortest',
    start: { placeId: start.id, name: start.name, sourceFacility: start.sourceFacility, nodeId: start.access.nodeId, attachmentDistanceMeters: start.access.distanceMeters, attachmentConfidence: start.access.confidence },
    destination: { placeId: destination.id, name: destination.name, sourceFacility: destination.sourceFacility, nodeId: destination.access.nodeId, attachmentDistanceMeters: destination.access.distanceMeters, attachmentConfidence: destination.access.confidence },
    route: { nodeIds: planned.network.nodeIds, edgeIds: planned.network.edgeIds, networkDistanceMeters: planned.network.distanceMeters, accessDistanceMeters: planned.accessDistanceMeters, totalJourneyDistanceMeters: planned.totalDistanceMeters },
    expandedCoverageFixture: { fromPlaceId: start.id, fromName: start.name, toPlaceId: expandedDestination.id, toName: expandedDestination.name, networkDistanceMeters: expandedCoverage.network.distanceMeters },
    multiFloorFixture: { fromPlaceId: multiFloorStart.id, toPlaceId: ground.id, floors: [...new Set(multiFloor.network.nodeIds.map((id) => graph.nodes.find((node) => node.id === id)!.floorId))], connectorEdgeIds: connectorEdges.map((edge) => edge!.id), connectorKinds: connectorEdges.map((edge) => edge!.kind).filter((kind): kind is 'elevator' | 'escalator' | 'stairs' => kind !== 'corridor'), networkDistanceMeters: multiFloor.network.distanceMeters },
    facilityFixtures,
  };
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (isMainModule(import.meta.url)) {
  const report = buildHumanGoldenRoute(process.argv[2] ?? NETWORK, process.argv[3] ?? PLACES, process.argv[4] ?? OUTPUT, process.argv[5] ?? REVIEWED_NETWORK);
  console.log(`Golden route: ${report.start.name} → ${report.destination.name}, ${report.route.networkDistanceMeters.toFixed(1)} m on the official network.`);
}
