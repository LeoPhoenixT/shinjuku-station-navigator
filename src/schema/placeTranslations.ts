import type { NamedPlacesDataset } from './processed.js';

export type TranslationStatus = 'specification' | 'reviewed' | 'pending';

export interface PlaceTranslationRecord {
  id: string;
  ja: string;
  en?: string;
  aliasesJa: string[];
  aliasesEn: string[];
  status: TranslationStatus;
  source: string;
}

export type AreaTranslationRecord = PlaceTranslationRecord;

export interface PlaceTranslationsDataset {
  schemaVersion: 1;
  generatedAt: string;
  places: PlaceTranslationRecord[];
  areas: AreaTranslationRecord[];
  statistics: {
    placeCount: number;
    areaCount: number;
    statusCounts: Record<TranslationStatus, number>;
    sourceCounts: Record<string, number>;
  };
}

export interface PlaceTranslationSource {
  schemaVersion: 1;
  places: PlaceTranslationRecord[];
  areas: AreaTranslationRecord[];
}

const STATUS_VALUES = ['specification', 'reviewed', 'pending'] as const;
const ROOT_KEYS = new Set(['schemaVersion', 'places', 'areas']);
const RECORD_KEYS = new Set(['id', 'ja', 'en', 'aliasesJa', 'aliasesEn', 'status', 'source']);

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>, label: string): void {
  const unsupported = Object.keys(value).filter((key) => !allowed.has(key));
  if (unsupported.length > 0) throw new Error(`${label} contains unsupported keys: ${unsupported.join(', ')}.`);
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label} must be a non-empty string.`);
  return value;
}

function aliases(value: unknown, label: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)) {
    throw new Error(`${label} must be an array of non-empty strings.`);
  }
  if (new Set(value).size !== value.length) throw new Error(`${label} contains duplicate values.`);
  return value;
}

function reviewedAreaJapaneseName(id: string): string {
  return id.replace(/^\d+\./, '').replaceAll('_', '・');
}

function parseRecords(
  value: unknown,
  label: 'place' | 'area',
  validJapaneseById: ReadonlyMap<string, string>,
  allowReviewedAreaCleanup: boolean,
): PlaceTranslationRecord[] {
  if (!Array.isArray(value)) throw new Error(`Translation ${label}s must be an array.`);
  const ids = new Set<string>();
  return value.map((entry, index) => {
    const record = object(entry, `${label} translation ${index}`);
    exactKeys(record, RECORD_KEYS, `${label} translation ${index}`);
    const id = nonEmptyString(record.id, `${label} translation ${index}.id`);
    if (ids.has(id)) throw new Error(`Duplicate ${label} translation ${id}.`);
    ids.add(id);
    const expectedJapanese = validJapaneseById.get(id);
    if (!expectedJapanese) throw new Error(`Unknown ${label} translation ID ${id}.`);
    const ja = nonEmptyString(record.ja, `${label} translation ${id}.ja`);
    const status = record.status;
    if (!STATUS_VALUES.includes(status as TranslationStatus)) throw new Error(`${label} translation ${id}.status is unsupported.`);
    const source = nonEmptyString(record.source, `${label} translation ${id}.source`);
    const en = record.en === undefined ? undefined : nonEmptyString(record.en, `${label} translation ${id}.en`);
    if (status !== 'pending' && !en) throw new Error(`${label} translation ${id} requires English text for status ${String(status)}.`);
    if (status === 'pending' && en) throw new Error(`${label} translation ${id} must not publish unreviewed English text.`);
    const acceptedJapanese = ja === expectedJapanese
      || (allowReviewedAreaCleanup && status === 'reviewed' && ja === reviewedAreaJapaneseName(expectedJapanese));
    if (!acceptedJapanese) throw new Error(`${label} translation ${id}.ja does not match its authoritative Japanese source.`);
    return {
      id,
      ja,
      ...(en ? { en } : {}),
      aliasesJa: aliases(record.aliasesJa, `${label} translation ${id}.aliasesJa`),
      aliasesEn: aliases(record.aliasesEn, `${label} translation ${id}.aliasesEn`),
      status: status as TranslationStatus,
      source,
    };
  });
}

function sourceMaps(namedPlaces: NamedPlacesDataset): {
  places: Map<string, string>;
  areas: Map<string, string>;
} {
  const routable = namedPlaces.places.filter(({ routable }) => routable);
  return {
    places: new Map(routable.map((place) => [place.id, place.name])),
    areas: new Map(routable.map((place) => [place.sourceFacility, place.sourceFacility])),
  };
}

export function parsePlaceTranslationSource(value: unknown, namedPlaces: NamedPlacesDataset): PlaceTranslationSource {
  const root = object(value, 'place translation source');
  exactKeys(root, ROOT_KEYS, 'place translation source');
  if (root.schemaVersion !== 1) throw new Error(`Unsupported place-translation source schemaVersion ${String(root.schemaVersion)}.`);
  const valid = sourceMaps(namedPlaces);
  return {
    schemaVersion: 1,
    places: parseRecords(root.places, 'place', valid.places, false),
    areas: parseRecords(root.areas, 'area', valid.areas, true),
  };
}

export function parsePlaceTranslations(value: unknown, namedPlaces: NamedPlacesDataset): PlaceTranslationsDataset {
  const root = object(value, 'place translations');
  const runtimeKeys = new Set([...ROOT_KEYS, 'generatedAt', 'statistics']);
  exactKeys(root, runtimeKeys, 'place translations');
  if (root.schemaVersion !== 1) throw new Error(`Unsupported place-translation schemaVersion ${String(root.schemaVersion)}.`);
  nonEmptyString(root.generatedAt, 'place translations.generatedAt');
  const valid = sourceMaps(namedPlaces);
  const places = parseRecords(root.places, 'place', valid.places, false);
  const areas = parseRecords(root.areas, 'area', valid.areas, true);
  if (places.length !== valid.places.size || places.some(({ id }) => !valid.places.has(id))) {
    throw new Error('Runtime place translations must cover every routable place exactly once.');
  }
  if (areas.length !== valid.areas.size || areas.some(({ id }) => !valid.areas.has(id))) {
    throw new Error('Runtime area translations must cover every public area exactly once.');
  }
  const statistics = object(root.statistics, 'place translations.statistics');
  if (statistics.placeCount !== places.length || statistics.areaCount !== areas.length) {
    throw new Error('Place-translation statistics do not match record counts.');
  }
  const statusCounts = object(statistics.statusCounts, 'place translations.statistics.statusCounts');
  const expectedStatusCounts: Record<TranslationStatus, number> = { specification: 0, reviewed: 0, pending: 0 };
  const expectedSourceCounts: Record<string, number> = {};
  for (const record of [...places, ...areas]) {
    expectedStatusCounts[record.status] += 1;
    expectedSourceCounts[record.source] = (expectedSourceCounts[record.source] ?? 0) + 1;
  }
  for (const status of STATUS_VALUES) {
    if (statusCounts[status] !== expectedStatusCounts[status]) throw new Error(`Place-translation status count ${status} is incorrect.`);
  }
  const sourceCounts = object(statistics.sourceCounts, 'place translations.statistics.sourceCounts');
  if (JSON.stringify(sourceCounts) !== JSON.stringify(expectedSourceCounts)) throw new Error('Place-translation source counts are incorrect.');
  return { ...root, places, areas } as unknown as PlaceTranslationsDataset;
}
