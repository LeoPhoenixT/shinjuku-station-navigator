import path from 'node:path';
import { buildHumanGoldenRoute } from './build-human-golden-route.js';
import { buildNamedPlaces } from './build-named-places.js';
import { buildPlaceTranslations } from './build-place-translations.js';
import { buildFullMap } from './build-full-map.js';
import { buildReviewedCustomNetwork } from './build-reviewed-custom-network.js';
import { buildFacilityMarkerReport } from './build-facility-marker-report.js';
import { convertDataset } from './convert-dataset.js';
import { importOfficialNetwork } from './import-official-network.js';
import { inspectDataset } from './inspect-dataset.js';
import { profileMapSemantics } from './profile-map-semantics.js';
import { profilePhase7Vertical } from './profile-phase7-vertical.js';
import { validateProcessedData } from './validate-data.js';
import { validateOfficialNetwork } from './validate-official-network.js';
import { isMainModule } from './data/is-main-module.js';

export const GENERATED_FILES = [
  'reports/dataset-inspection.json',
  'reports/processed-data-validation.json',
  'reports/map-semantics-profile.json',
  'reports/facility-marker-review.json',
  'reports/phase7-vertical-profile.json',
  'reports/official-network-validation.json',
  'reports/human-golden-route.json',
  'reports/place-translation-coverage.json',
  'public/data/processed/jr-shinjuku-ticket-gates-b1.json',
  'public/data/processed/jr-shinjuku-ticket-gates-b1-official-network.json',
  'public/data/processed/shinjuku-reviewed-custom-network.json',
  'public/data/processed/shinjuku-b1-named-places.json',
  'public/data/processed/shinjuku-place-translations.json',
  'public/data/processed/shinjuku-full-map.json',
] as const;

function output(root: string, relative: typeof GENERATED_FILES[number]): string {
  return path.join(root, relative);
}

export function buildAllData(root = '.'): void {
  const inspection = output(root, 'reports/dataset-inspection.json');
  const floor = output(root, 'public/data/processed/jr-shinjuku-ticket-gates-b1.json');
  const floorValidation = output(root, 'reports/processed-data-validation.json');
  const profile = output(root, 'reports/map-semantics-profile.json');
  const markerReport = output(root, 'reports/facility-marker-review.json');
  const verticalProfile = output(root, 'reports/phase7-vertical-profile.json');
  const network = output(root, 'public/data/processed/jr-shinjuku-ticket-gates-b1-official-network.json');
  const networkValidation = output(root, 'reports/official-network-validation.json');
  const reviewedNetwork = output(root, 'public/data/processed/shinjuku-reviewed-custom-network.json');
  const places = output(root, 'public/data/processed/shinjuku-b1-named-places.json');
  const translations = output(root, 'public/data/processed/shinjuku-place-translations.json');
  const translationCoverage = output(root, 'reports/place-translation-coverage.json');
  const fullMap = output(root, 'public/data/processed/shinjuku-full-map.json');
  const golden = output(root, 'reports/human-golden-route.json');
  inspectDataset('shapefile', inspection);
  convertDataset(floor);
  validateProcessedData(floor, floorValidation, 'public/data/processed/jr-shinjuku-ticket-gates-b1.json');
  profileMapSemantics(undefined, profile);
  profilePhase7Vertical(verticalProfile);
  importOfficialNetwork(network);
  validateOfficialNetwork(network, networkValidation, 'public/data/processed/jr-shinjuku-ticket-gates-b1-official-network.json');
  buildReviewedCustomNetwork(network, reviewedNetwork);
  buildFullMap(fullMap);
  buildNamedPlaces(network, places, fullMap, reviewedNetwork);
  buildPlaceTranslations(places, 'data/place-translations.source.json', translations, translationCoverage);
  buildFacilityMarkerReport(fullMap, network, markerReport);
  buildHumanGoldenRoute(network, places, golden, reviewedNetwork);
}

if (isMainModule(import.meta.url)) {
  buildAllData(process.argv[2] ?? '.');
  console.log(`Built ${GENERATED_FILES.length} deterministic data artifacts.`);
}
