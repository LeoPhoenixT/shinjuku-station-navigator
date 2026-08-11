import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { resolveIndoorMapCategory } from '../src/data/indoorMapCategories.js';
import { parseNamedPlaces } from '../src/schema/processed.js';
import {
  parsePlaceTranslationSource,
  parsePlaceTranslations,
  type PlaceTranslationRecord,
  type PlaceTranslationsDataset,
  type TranslationStatus,
} from '../src/schema/placeTranslations.js';
import { isMainModule } from './data/is-main-module.js';

const PLACES = 'public/data/processed/shinjuku-b1-named-places.json';
const SOURCE = 'data/place-translations.source.json';
const OUTPUT = 'public/data/processed/shinjuku-place-translations.json';
const REPORT = 'reports/place-translation-coverage.json';
const OFFICIAL_LAVATORY_CODES = new Set(['B007', 'B008', 'B010', 'B011']);

function specificationTranslation(place: ReturnType<typeof parseNamedPlaces>['places'][number]): PlaceTranslationRecord | undefined {
  if (
    place.sourceLayer === 'Space'
    && place.sourceCategoryCode !== undefined
    && OFFICIAL_LAVATORY_CODES.has(place.sourceCategoryCode)
  ) {
    const category = resolveIndoorMapCategory('Space', place.sourceCategoryCode);
    if (!category.known) return undefined;
    return {
      id: place.id,
      ja: place.name,
      en: category.nameEn,
      aliasesJa: place.name === category.nameJa ? [] : [category.nameJa],
      aliasesEn: [],
      status: 'specification',
      source: `${category.source.document} table ${category.source.table}`,
    };
  }

  if (place.nameKind !== 'generated-category' || place.sourceLayer !== 'Facility') return undefined;
  const category = resolveIndoorMapCategory('Facility', place.sourceCategoryCode);
  if (!category.known || !place.name.startsWith(category.nameJa)) return undefined;
  const suffix = place.name.slice(category.nameJa.length);
  return {
    id: place.id,
    ja: place.name,
    en: `${category.nameEn}${suffix}`,
    aliasesJa: [category.nameJa],
    aliasesEn: [category.nameEn],
    status: 'specification',
    source: `${category.source.document} table ${category.source.table}`,
  };
}

function increment(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

export function buildPlaceTranslations(
  placesInput = PLACES,
  sourceInput = SOURCE,
  output = OUTPUT,
  reportOutput = REPORT,
): PlaceTranslationsDataset {
  const namedPlaces = parseNamedPlaces(JSON.parse(readFileSync(placesInput, 'utf8')));
  const source = parsePlaceTranslationSource(JSON.parse(readFileSync(sourceInput, 'utf8')), namedPlaces);
  const explicitPlaces = new Map(source.places.map((record) => [record.id, record]));
  const places = namedPlaces.places.filter(({ routable }) => routable).map((place): PlaceTranslationRecord =>
    explicitPlaces.get(place.id)
    ?? specificationTranslation(place)
    ?? {
      id: place.id,
      ja: place.name,
      aliasesJa: [],
      aliasesEn: [],
      status: 'pending',
      source: 'authoritative-japanese-fallback',
    });
  places.sort((a, b) => a.id.localeCompare(b.id));
  const areas = [...source.areas].sort((a, b) => a.id.localeCompare(b.id));
  const statusCounts: Record<TranslationStatus, number> = { specification: 0, reviewed: 0, pending: 0 };
  const sourceCounts: Record<string, number> = {};
  for (const record of [...places, ...areas]) {
    statusCounts[record.status] += 1;
    increment(sourceCounts, record.source);
  }
  const dataset: PlaceTranslationsDataset = {
    schemaVersion: 1,
    generatedAt: new Date(0).toISOString(),
    places,
    areas,
    statistics: { placeCount: places.length, areaCount: areas.length, statusCounts, sourceCounts },
  };
  parsePlaceTranslations(dataset, namedPlaces);

  const placeById = new Map(namedPlaces.places.map((place) => [place.id, place]));
  const pendingPlaceIds = places.filter(({ status }) => status === 'pending').map(({ id }) => id);
  const pendingAreaIds = areas.filter(({ status }) => status === 'pending').map(({ id }) => id);
  const report = {
    schemaVersion: 1,
    generatedAt: new Date(0).toISOString(),
    summary: {
      routablePlaceCount: places.length,
      publicAreaCount: areas.length,
      reviewedOrSpecificationEnglishPlaceCount: places.length - pendingPlaceIds.length,
      reviewedOrSpecificationEnglishAreaCount: areas.length - pendingAreaIds.length,
      pendingJapaneseFallbackPlaceCount: pendingPlaceIds.length,
      pendingJapaneseFallbackAreaCount: pendingAreaIds.length,
    },
    coverage: {
      routablePlaces: { covered: places.length, total: namedPlaces.places.filter(({ routable }) => routable).length },
      facilityMarkers: {
        covered: places.filter(({ id }) => placeById.get(id)?.sourceLayer === 'Facility').length,
        total: namedPlaces.places.filter((place) => place.routable && place.sourceLayer === 'Facility').length,
      },
      permanentLabels: {
        covered: places.filter(({ id }) => placeById.get(id)?.category === 'gate').length,
        total: namedPlaces.places.filter((place) => place.routable && place.category === 'gate').length,
      },
      publicAreas: { covered: areas.length, total: new Set(namedPlaces.places.filter(({ routable }) => routable).map(({ sourceFacility }) => sourceFacility)).size },
    },
    statusCounts,
    sourceCounts,
    pendingPlaceIds,
    pendingAreaIds,
  };
  mkdirSync(path.dirname(output), { recursive: true });
  mkdirSync(path.dirname(reportOutput), { recursive: true });
  writeFileSync(output, `${JSON.stringify(dataset, null, 2)}\n`);
  writeFileSync(reportOutput, `${JSON.stringify(report, null, 2)}\n`);
  return dataset;
}

if (isMainModule(import.meta.url)) {
  const dataset = buildPlaceTranslations(process.argv[2] ?? PLACES, process.argv[3] ?? SOURCE, process.argv[4] ?? OUTPUT, process.argv[5] ?? REPORT);
  console.log(`Built translations for ${dataset.places.length} places and ${dataset.areas.length} areas.`);
}
