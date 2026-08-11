import { describe, expect, it } from 'vitest';
import { buildDefaultFacilityCategoryCodes, EXIT_CATEGORY_CODE, GATE_CATEGORY_CODE } from '../src/hooks/useMapDisplayPreferences';
import { facilityMarkerMatchesPreferences, placeHasPermanentLabel } from '../src/map/displayPreferences';
import type { FacilityMarkerCandidate } from '../src/map/facilityMarkers';
import type { NamedPlaceRecord } from '../src/schema/processed';

const marker = { categoryCode: 'F012', priority: 1 } as FacilityMarkerCandidate;
const place = { id: 'gate', routable: true, category: 'gate' } as NamedPlaceRecord;

describe('map display preferences', () => {
  it('defaults the no-route overview to ticket gates and reviewed exits', () => {
    expect(buildDefaultFacilityCategoryCodes()).toEqual(new Set([GATE_CATEGORY_CODE, EXIT_CATEGORY_CODE]));
  });

  it('combines category preferences with permanently hidden marker categories', () => {
    expect(facilityMarkerMatchesPreferences(marker, new Set(['F012']))).toBe(true);
    expect(facilityMarkerMatchesPreferences(marker, new Set(['F001']))).toBe(false);
    expect(facilityMarkerMatchesPreferences({ ...marker, categoryCode: 'F011' }, new Set(['F011']))).toBe(false);
    expect(facilityMarkerMatchesPreferences({ ...marker, categoryCode: 'F014' }, new Set(['F014']))).toBe(false);
  });

  it('always labels gates and active endpoints but leaves other places as markers', () => {
    expect(placeHasPermanentLabel(place, '', '')).toBe(true);
    expect(placeHasPermanentLabel(place, '', '', false)).toBe(false);
    expect(placeHasPermanentLabel({ ...place, id: 'toilet', category: 'toilet' }, 'toilet', '')).toBe(true);
    expect(placeHasPermanentLabel({ ...place, id: 'toilet', category: 'toilet' }, '', 'toilet')).toBe(true);
    expect(placeHasPermanentLabel({ ...place, id: 'toilet', category: 'toilet' }, '', '')).toBe(false);
  });
});
