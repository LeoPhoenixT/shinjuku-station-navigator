import { describe, expect, it } from 'vitest';
import {
  FACILITY_CATEGORIES,
  FIXTURE_CATEGORIES,
  INDOOR_MAP_CATEGORIES,
  resolveIndoorMapCategory,
  SPACE_CATEGORIES,
} from '../src/data/indoorMapCategories';

describe('authoritative indoor-map category registry', () => {
  it('contains the planned non-TWSI Space, Fixture, and Facility definitions without duplicate layer codes', () => {
    expect(SPACE_CATEGORIES).toHaveLength(32);
    expect(FIXTURE_CATEGORIES).toHaveLength(22);
    expect(FACILITY_CATEGORIES).toHaveLength(59);
    expect(new Set(INDOOR_MAP_CATEGORIES.map(({ layer, code }) => `${layer}:${code}`)).size).toBe(INDOOR_MAP_CATEGORIES.length);
  });

  it('resolves representative categories with bilingual names and semantic treatment', () => {
    expect(resolveIndoorMapCategory('Space', ' b022 ')).toMatchObject({
      code: 'B022', nameJa: 'エレベーターの範囲', nameEn: 'Elevator', role: 'vertical-circulation',
      visual: { group: 'elevator', geometry: 'surface' }, destinationEligible: true, accessibilityRelevant: true, known: true,
    });
    expect(resolveIndoorMapCategory('Space', 'B001')).toMatchObject({ visual: { group: 'retail' } });
    expect(resolveIndoorMapCategory('Space', 'B004')).toMatchObject({ visual: { group: 'waiting' } });
    expect(resolveIndoorMapCategory('Space', 'B005')).toMatchObject({ visual: { group: 'ticket' } });
    expect(resolveIndoorMapCategory('Space', 'B006')).toMatchObject({ visual: { group: 'information' } });
    expect(resolveIndoorMapCategory('Space', 'B018')).toMatchObject({ visual: { group: 'office' } });
    expect(resolveIndoorMapCategory('Fixture', 'C010')).toMatchObject({
      nameJa: 'パーテーション・間仕切壁', role: 'structure', visual: { group: 'wall', geometry: 'thin-barrier' }, known: true,
    });
    expect(resolveIndoorMapCategory('Facility', 'F108')).toMatchObject({
      nameJa: '出口', nameEn: 'Exit', visual: { group: 'exit', geometry: 'point-marker' }, searchable: true, destinationEligible: true, known: true,
    });
  });

  it('keeps unknown values explicit, source-preserving, and ineligible for public search or routing', () => {
    expect(resolveIndoorMapCategory('Facility', ' f777 ')).toEqual({
      code: 'F777', layer: 'Facility', nameJa: '不明なカテゴリー', nameEn: 'Unknown category', role: 'unknown',
      visual: { group: 'unknown', colorToken: 'map-unknown', geometry: 'point-marker' }, searchable: false,
      destinationEligible: false, accessibilityRelevant: false, source: null, known: false,
    });
  });

  it('does not map tactile Fixture categories excluded from this enhancement', () => {
    for (const code of ['C017', 'C018', 'C019', 'C103']) {
      expect(resolveIndoorMapCategory('Fixture', code)).toMatchObject({ code, known: false });
    }
  });

  it('records a specification table and PDF page for every authoritative definition', () => {
    expect(INDOOR_MAP_CATEGORIES.every(({ source }) => source.document === 'MLIT source package 製品仕様書.pdf' && source.pdfPage >= 35 && source.pdfPage <= 40)).toBe(true);
  });
});
