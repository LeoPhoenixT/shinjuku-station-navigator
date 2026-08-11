import { describe, expect, it } from 'vitest';
import { auditSemanticRecords, profileValues, type SemanticAuditRecord } from '../scripts/profile-map-semantics.js';

describe('Phase 5A map semantics profiling', () => {
  it('reports deterministic null rates and ordered value frequencies', () => {
    expect(profileValues(['2', null, '1', '2', null])).toEqual({
      recordCount: 5,
      nullCount: 2,
      nullRate: 0.4,
      distinctCount: 2,
      values: [
        { value: '2', count: 2 },
        { value: '1', count: 1 },
      ],
    });
  });

  it('uses a bounded deterministic sample for high-cardinality fields', () => {
    const profile = profileValues(Array.from({ length: 60 }, (_, index) => `id-${String(index).padStart(2, '0')}`));
    expect(profile.distinctCount).toBe(60);
    expect(profile.values).toBeUndefined();
    expect(profile.sample).toHaveLength(12);
    expect(profile.sample?.[0]).toBe('id-00');
  });

  it('audits category semantics, geometry, floors, areas, names, bounds, and deterministic examples', () => {
    const records: SemanticAuditRecord[] = [
      { layer: 'Facility', category: 'F108', name: '南口', floor: 'B1', sourceArea: '1.JR', sourceFile: 'z.dbf', sourceRecord: 2, geometry: { type: 'Point', coordinates: [4, 8] } },
      { layer: 'Facility', category: 'F108', name: null, floor: 'B1', sourceArea: '1.JR', sourceFile: 'a.dbf', sourceRecord: 1, geometry: { type: 'Point', coordinates: [2, 3] } },
      { layer: 'Facility', category: 'F777', name: 'Review', floor: null, sourceArea: '2.Keio', sourceFile: 'b.dbf', sourceRecord: 3, geometry: null },
      { layer: 'Facility', category: null, name: null, floor: '0', sourceArea: '2.Keio', sourceFile: 'b.dbf', sourceRecord: 4, geometry: { type: 'Point', coordinates: [-1, 5] } },
    ];
    const audit = auditSemanticRecords('Facility', records);
    expect(audit).toMatchObject({ featureCount: 4, categoryCount: 3, missingCategoryCount: 1, missingFloorCount: 1, unknownCategoryCodes: ['(missing)', 'F777'] });
    expect(audit.categories.find(({ code }) => code === 'F108')).toMatchObject({
      known: true, nameEn: 'Exit', recordCount: 2, namedCount: 1, unnamedCount: 1,
      geometryTypes: { Point: 2 }, floors: { B1: 2 }, sourceAreas: { '1.JR': 2 }, bounds: [2, 3, 4, 8], malformedRecordCount: 0,
      examples: [{ sourceFile: 'a.dbf', sourceRecord: 1 }, { sourceFile: 'z.dbf', sourceRecord: 2 }],
    });
  });
});
