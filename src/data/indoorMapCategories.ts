export type IndoorMapCategoryLayer = 'Space' | 'Fixture' | 'Facility';

export type IndoorMapSemanticRole =
  | 'room'
  | 'toilet'
  | 'multipurpose-toilet'
  | 'vertical-circulation'
  | 'circulation'
  | 'platform'
  | 'restricted'
  | 'outdoor'
  | 'structure'
  | 'furniture'
  | 'barrier'
  | 'service'
  | 'transport'
  | 'amenity'
  | 'safety'
  | 'information'
  | 'landmark'
  | 'unknown';

export type IndoorMapVisualGroup =
  | 'room'
  | 'retail'
  | 'office'
  | 'waiting'
  | 'ticket'
  | 'information'
  | 'toilet'
  | 'multipurpose-toilet'
  | 'stairs'
  | 'elevator'
  | 'escalator'
  | 'moving-walkway'
  | 'slope'
  | 'walkway'
  | 'platform'
  | 'restricted'
  | 'outdoor'
  | 'column'
  | 'wall'
  | 'barrier'
  | 'furniture'
  | 'fixture'
  | 'entrance'
  | 'exit'
  | 'poi'
  | 'safety'
  | 'unknown';

export interface IndoorMapVisualTreatment {
  group: IndoorMapVisualGroup;
  colorToken: `map-${string}`;
  geometry: 'surface' | 'solid' | 'low-solid' | 'thin-barrier' | 'point-marker';
}
export interface IndoorMapCategoryDefinition {
  code: string;
  layer: IndoorMapCategoryLayer;
  nameJa: string;
  nameEn: string;
  role: IndoorMapSemanticRole;
  visual: IndoorMapVisualTreatment;
  searchable: boolean;
  destinationEligible: boolean;
  accessibilityRelevant: boolean;
  source: {
    document: 'MLIT source package 製品仕様書.pdf';
    table: '8.1.4' | '8.1.5' | '8.3.1';
    pdfPage: number;
  };
  known: true;
}

export interface UnknownIndoorMapCategory {
  code: string;
  layer: IndoorMapCategoryLayer;
  nameJa: '不明なカテゴリー';
  nameEn: 'Unknown category';
  role: 'unknown';
  visual: IndoorMapVisualTreatment;
  searchable: false;
  destinationEligible: false;
  accessibilityRelevant: false;
  source: null;
  known: false;
}

export type ResolvedIndoorMapCategory = IndoorMapCategoryDefinition | UnknownIndoorMapCategory;

type CategoryInput = Omit<IndoorMapCategoryDefinition, 'known' | 'source'> & {
  table: IndoorMapCategoryDefinition['source']['table'];
  pdfPage: number;
};

const surface = (group: IndoorMapVisualGroup): IndoorMapVisualTreatment => ({ group, colorToken: `map-${group}`, geometry: 'surface' });
const solid = (group: IndoorMapVisualGroup): IndoorMapVisualTreatment => ({ group, colorToken: `map-${group}`, geometry: 'solid' });
const lowSolid = (group: IndoorMapVisualGroup): IndoorMapVisualTreatment => ({ group, colorToken: `map-${group}`, geometry: 'low-solid' });
const barrier = (group: IndoorMapVisualGroup): IndoorMapVisualTreatment => ({ group, colorToken: `map-${group}`, geometry: 'thin-barrier' });
const marker = (group: IndoorMapVisualGroup): IndoorMapVisualTreatment => ({ group, colorToken: `map-${group}`, geometry: 'point-marker' });

function category(input: CategoryInput): IndoorMapCategoryDefinition {
  const { table, pdfPage, ...definition } = input;
  return { ...definition, known: true, source: { document: 'MLIT source package 製品仕様書.pdf', table, pdfPage } };
}

function space(code: string, nameJa: string, nameEn: string, role: IndoorMapSemanticRole, group: IndoorMapVisualGroup, searchable = false, destinationEligible = false, accessibilityRelevant = false, pdfPage = 35): IndoorMapCategoryDefinition {
  return category({ code, layer: 'Space', nameJa, nameEn, role, visual: surface(group), searchable, destinationEligible, accessibilityRelevant, table: '8.1.4', pdfPage });
}

function fixture(code: string, nameJa: string, nameEn: string, role: IndoorMapSemanticRole, visual: IndoorMapVisualTreatment, pdfPage = 37): IndoorMapCategoryDefinition {
  return category({ code, layer: 'Fixture', nameJa, nameEn, role, visual, searchable: false, destinationEligible: false, accessibilityRelevant: role === 'barrier' || role === 'structure', table: '8.1.5', pdfPage });
}

function facility(code: string, nameJa: string, nameEn: string, role: IndoorMapSemanticRole, group: IndoorMapVisualGroup, searchable: boolean, destinationEligible: boolean, accessibilityRelevant = false, pdfPage = 38): IndoorMapCategoryDefinition {
  return category({ code, layer: 'Facility', nameJa, nameEn, role, visual: marker(group), searchable, destinationEligible, accessibilityRelevant, table: '8.3.1', pdfPage });
}

export const SPACE_CATEGORIES = [
  space('B001', '商業施設', 'Retail Store', 'room', 'retail', true, true),
  space('B002', '事務所', 'Office', 'room', 'office'),
  space('B003', '公的施設', 'Public Facility', 'room', 'room', true, true),
  space('B004', '待合室・休憩所', 'Waiting Room', 'room', 'waiting', true, true),
  space('B005', 'きっぷ売り場', 'Tickets', 'service', 'ticket', true, true),
  space('B006', '受付・案内', 'Information', 'information', 'information', true, true),
  space('B007', 'トイレ（男性用）', 'Lavatory (Male)', 'toilet', 'toilet', true, true, true, 36),
  space('B008', 'トイレ（女性用）', 'Lavatory (Female)', 'toilet', 'toilet', true, true, true, 36),
  space('B009', 'トイレ（男女共用）', 'Lavatory (Unisex)', 'toilet', 'toilet', true, true, true, 36),
  space('B010', 'トイレ（男女不明）', 'Lavatory (Unspecified)', 'toilet', 'toilet', true, true, true, 36),
  space('B011', '多機能トイレ', 'Multipurpose Lavatory', 'multipurpose-toilet', 'multipurpose-toilet', true, true, true, 36),
  space('B012', '多機能トイレ（オストメイト対応あり）', 'Multipurpose Lavatory (Ostomate)', 'multipurpose-toilet', 'multipurpose-toilet', true, true, true, 36),
  space('B013', '多機能トイレ（おむつ交換シートあり）', 'Multipurpose Lavatory (Change Diaper)', 'multipurpose-toilet', 'multipurpose-toilet', true, true, true, 36),
  space('B014', '多機能トイレ（オストメイト対応、おむつ交換シートあり）', 'Multipurpose Lavatory (Ostomate, Change Diaper)', 'multipurpose-toilet', 'multipurpose-toilet', true, true, true, 36),
  space('B015', '喫煙場所', 'Smoking Area', 'amenity', 'room', true, true, false, 36),
  space('B016', '授乳室', 'Baby-feeding Room, Nursing Room', 'amenity', 'room', true, true, true, 36),
  space('B017', '病院・救護室', 'First Aid', 'safety', 'room', true, true, true, 36),
  space('B018', '駅事務室', 'Station Office', 'service', 'office', true, false, false, 36),
  space('B019', 'その他部屋の範囲', 'Other Room', 'room', 'room', false, false, false, 36),
  space('B020', '吹抜の範囲', 'Open to Below', 'structure', 'barrier', false, false, true, 36),
  space('B021', '階段の範囲', 'Stairs', 'vertical-circulation', 'stairs', true, true, true, 36),
  space('B022', 'エレベーターの範囲', 'Elevator', 'vertical-circulation', 'elevator', true, true, true, 36),
  space('B023', 'エスカレーターの範囲', 'Escalator', 'vertical-circulation', 'escalator', true, true, true, 36),
  space('B024', '動く歩道の範囲', 'Moving Walkway', 'circulation', 'moving-walkway', true, true, true, 36),
  space('B025', 'スロープの範囲', 'Slope', 'vertical-circulation', 'slope', true, true, true, 36),
  space('B026', '非公開の範囲', 'Non-Public', 'restricted', 'restricted', false, false, true, 36),
  space('B027', '駐車場', 'Parking', 'transport', 'room', true, true, true, 36),
  space('B028', 'プラットホーム', 'Platform', 'platform', 'platform', true, true, true, 36),
  space('B029', '通路／コンコース', 'Walkway', 'circulation', 'walkway', false, false, true, 36),
  space('B030', 'ペデストリアンデッキ', 'Pedestrian Deck', 'circulation', 'walkway', false, false, true, 36),
  space('B031', '歩道橋', 'Pedestrian Overpass', 'circulation', 'walkway', false, false, true, 36),
  space('B999', '屋外', 'Outside', 'outdoor', 'outdoor', false, false, true, 36),
] as const satisfies readonly IndoorMapCategoryDefinition[];

export const FIXTURE_CATEGORIES = [
  fixture('C001', '柱', 'Column', 'structure', solid('column')),
  fixture('C002', 'ベンチ', 'Bench', 'furniture', lowSolid('furniture')),
  fixture('C003', '受付・インフォメーションデスク', 'Reception and Information Desks', 'furniture', lowSolid('furniture')),
  fixture('C004', '机・記帳台', 'Cubicle', 'furniture', lowSolid('furniture')),
  fixture('C005', 'ゴミ箱', 'Rubbish Bin', 'furniture', lowSolid('furniture')),
  fixture('C006', 'その他家具・什器', 'Other Furniture / Fixtures', 'furniture', lowSolid('furniture')),
  fixture('C007', '小形簡易売店', 'Kiosk', 'service', solid('fixture')),
  fixture('C008', '障害物', 'Obstruction', 'barrier', solid('barrier')),
  fixture('C009', '植栽・花壇', 'Vegetation', 'barrier', lowSolid('barrier')),
  fixture('C010', 'パーテーション・間仕切壁', 'Wall', 'structure', barrier('wall')),
  fixture('C011', '水部等', 'Water', 'barrier', lowSolid('barrier')),
  fixture('C012', 'ロッカー', 'Locker Cabinet', 'furniture', solid('furniture')),
  fixture('C013', '自動販売機', 'Vending Machine', 'furniture', solid('furniture')),
  fixture('C014', 'ATM', 'ATM', 'service', solid('fixture')),
  fixture('C015', 'ステージ', 'Stage Platform', 'barrier', lowSolid('barrier')),
  fixture('C016', '柵', 'Fence', 'barrier', barrier('barrier')),
  fixture('C101', 'ホームドア・可動式ホーム柵等', 'Platform Screen Doors, Platform Gates', 'barrier', barrier('barrier'), 38),
  fixture('C102', '自動券売機', 'Ticket Vending Machine', 'service', solid('fixture'), 38),
  fixture('C104', '自動改札機', 'Automatic Ticket Gate', 'barrier', lowSolid('barrier'), 38),
  fixture('C201', 'ターンテーブル', 'Baggage Carousel', 'furniture', lowSolid('furniture'), 38),
  fixture('C202', '自動チェックイン機', 'Passenger Ticketing / Automated Check-In Kiosk', 'service', solid('fixture'), 38),
  fixture('C999', 'その他', 'Uncategorized', 'unknown', solid('unknown'), 38),
] as const satisfies readonly IndoorMapCategoryDefinition[];

export const FACILITY_CATEGORIES = [
  facility('F001', 'トイレ（男性）', 'Lavatory (Male)', 'toilet', 'toilet', true, true, true),
  facility('F002', 'トイレ（女性）', 'Lavatory (Female)', 'toilet', 'toilet', true, true, true),
  facility('F003', 'トイレ（男女共用）', 'Lavatory (Unisex)', 'toilet', 'toilet', true, true, true),
  facility('F004', 'トイレ（男女不明）', 'Lavatory (Unspecified)', 'toilet', 'toilet', true, true, true),
  facility('F005', '多機能トイレ', 'Multipurpose Lavatory', 'multipurpose-toilet', 'multipurpose-toilet', true, true, true),
  facility('F006', '多機能トイレ（オストメイト対応あり）', 'Multipurpose Lavatory (Ostomate)', 'multipurpose-toilet', 'multipurpose-toilet', true, true, true),
  facility('F007', '多機能トイレ（おむつ交換シートあり）', 'Multipurpose Lavatory (Change Diaper)', 'multipurpose-toilet', 'multipurpose-toilet', true, true, true),
  facility('F008', '多機能トイレ（オストメイト対応、おむつ交換シートあり）', 'Multipurpose Lavatory (Ostomate, Change Diaper)', 'multipurpose-toilet', 'multipurpose-toilet', true, true, true),
  facility('F009', '浴室', 'Bathroom', 'amenity', 'poi', true, true, true, 39),
  facility('F010', '更衣室', 'Changing Room', 'amenity', 'poi', true, true, true, 39),
  facility('F011', '階段', 'Stairs', 'vertical-circulation', 'stairs', true, true, true, 39),
  facility('F012', 'エレベーター', 'Elevator', 'vertical-circulation', 'elevator', true, true, true, 39),
  facility('F013', 'エスカレーター', 'Escalator', 'vertical-circulation', 'escalator', true, true, true, 39),
  facility('F014', 'スロープ', 'Slope', 'vertical-circulation', 'slope', true, true, true, 39),
  facility('F015', '動く歩道', 'Moving Walkway', 'circulation', 'moving-walkway', true, true, true, 39),
  facility('F016', '施設代表点', 'Site', 'landmark', 'poi', true, false, false, 39),
  facility('F017', '施設出入口', 'Entrance', 'transport', 'entrance', true, true, true, 39),
  facility('F018', '受付・案内所', 'Information', 'information', 'poi', true, true, true, 39),
  facility('F019', '交番', 'Police Box', 'safety', 'safety', true, true, true, 39),
  facility('F020', '待合室', 'Waiting Room', 'amenity', 'poi', true, true, true, 39),
  facility('F021', '授乳室', 'Nursing Room', 'amenity', 'poi', true, true, true, 39),
  facility('F022', '医療施設', 'Medical', 'safety', 'safety', true, true, true, 39),
  facility('F023', '見学・展望施設', 'Observation', 'amenity', 'poi', true, true, true, 39),
  facility('F024', '喫煙エリア', 'Smoking Area', 'amenity', 'poi', true, true, false, 39),
  facility('F025', '店舗', 'Store', 'amenity', 'poi', true, true, false, 39),
  facility('F026', '飲食コーナー', 'Eating / Drinking', 'amenity', 'poi', true, true, false, 39),
  facility('F027', 'AED', 'AED', 'safety', 'safety', true, true, true, 39),
  facility('F028', '公衆電話', 'Pay Phone', 'amenity', 'poi', true, true, true, 39),
  facility('F029', '郵便ポスト', 'Post', 'amenity', 'poi', true, true, false, 39),
  facility('F030', 'ATM', 'ATM', 'service', 'poi', true, true, true, 39),
  facility('F031', 'コインロッカー', 'Coin Lockers', 'amenity', 'poi', true, true, true, 39),
  facility('F032', '自動販売機', 'Vending Machine', 'amenity', 'poi', true, false, false, 39),
  facility('F033', 'ベンチ', 'Bench', 'amenity', 'poi', true, false, true, 39),
  facility('F034', 'ゴミ箱', 'Rubbish Bin', 'amenity', 'poi', false, false, false, 39),
  facility('F035', '階段昇降機／段差解消機', 'Stairway Platform Lifts / Vertical Platform', 'vertical-circulation', 'elevator', true, true, true, 39),
  facility('F036', '充電ステーション', 'Charging Stations', 'amenity', 'poi', true, true, true, 39),
  facility('F037', '案内サイン／案内板', 'Guide Sign', 'information', 'poi', true, false, true, 39),
  facility('F038', 'バス停留所', 'Bus Stop', 'transport', 'poi', true, true, true, 39),
  facility('F039', 'タクシー乗り場', 'Taxi Stop', 'transport', 'poi', true, true, true, 40),
  facility('F040', '駐輪場', 'Bicycle Parking Lot', 'transport', 'poi', true, true, true, 40),
  facility('F041', '駐車場', 'Parking', 'transport', 'poi', true, true, true, 40),
  facility('F042', '地図表記用注記', 'Notes for Map Representation', 'information', 'poi', false, false, false, 40),
  facility('F043', 'ランドマーク', 'Landmark', 'landmark', 'poi', true, true, false, 40),
  facility('F044', '展示物', 'Exhibit', 'landmark', 'poi', true, true, false, 40),
  facility('F045', '公衆無線LAN', 'Public Wi-Fi', 'amenity', 'poi', true, true, true, 40),
  facility('F046', '消火器', 'Fire Extinguisher', 'safety', 'safety', true, false, true, 40),
  facility('F047', '消火栓', 'Fire Hydrant', 'safety', 'safety', true, false, true, 40),
  facility('F048', '火災報知器', 'Fire Alarm', 'safety', 'safety', true, false, true, 40),
  facility('F049', '非常誘導灯', 'Emergency Guide Light', 'safety', 'safety', true, false, true, 40),
  facility('F050', '音による案内設備', 'Sound Guidance Facility', 'information', 'poi', true, false, true, 40),
  facility('F101', 'きっぷ売り場', 'Ticket Office', 'service', 'poi', true, true, true, 40),
  facility('F102', '定期券売り場', 'Commuter Ticket Office', 'service', 'poi', true, true, true, 40),
  facility('F103', '精算所', 'Fare Adjustment', 'service', 'poi', true, true, true, 40),
  facility('F104', '駅事務室', 'Station Staffroom', 'service', 'poi', true, false, false, 40),
  facility('F105', '忘れもの預かり所', 'Lost and Found', 'service', 'poi', true, true, true, 40),
  facility('F106', '改札口', 'Ticket Gate', 'transport', 'poi', true, true, true, 40),
  facility('F107', '売店／キオスク', 'Kiosk', 'amenity', 'poi', true, true, false, 40),
  facility('F108', '出口', 'Exit', 'transport', 'exit', true, true, true, 40),
  facility('F109', 'インターホン', 'Interphone', 'safety', 'safety', true, true, true, 40),
] as const satisfies readonly IndoorMapCategoryDefinition[];

export const INDOOR_MAP_CATEGORIES: readonly IndoorMapCategoryDefinition[] = [
  ...SPACE_CATEGORIES,
  ...FIXTURE_CATEGORIES,
  ...FACILITY_CATEGORIES,
];

const categoryByLayerAndCode = new Map(INDOOR_MAP_CATEGORIES.map((definition) => [`${definition.layer}:${definition.code}`, definition]));

export function normalizeIndoorMapCategoryCode(code: unknown): string {
  return typeof code === 'string' ? code.trim().toUpperCase() : String(code ?? '').trim().toUpperCase();
}

export function resolveIndoorMapCategory(layer: IndoorMapCategoryLayer, sourceCode: unknown): ResolvedIndoorMapCategory {
  const code = normalizeIndoorMapCategoryCode(sourceCode);
  const known = categoryByLayerAndCode.get(`${layer}:${code}`);
  if (known) return known;
  return {
    code,
    layer,
    nameJa: '不明なカテゴリー',
    nameEn: 'Unknown category',
    role: 'unknown',
    visual: { group: 'unknown', colorToken: 'map-unknown', geometry: layer === 'Facility' ? 'point-marker' : layer === 'Space' ? 'surface' : 'solid' },
    searchable: false,
    destinationEligible: false,
    accessibilityRelevant: false,
    source: null,
    known: false,
  };
}
