import { describe, expect, it } from 'vitest';
import { buildDefaultFacilityCategoryCodes, EXIT_CATEGORY_CODE, GATE_CATEGORY_CODE } from '../src/hooks/useMapDisplayPreferences';
import { facilityMarkerMatchesPreferences, placeMarkerDetail } from '../src/map/displayPreferences';
import type { FacilityMarkerCandidate } from '../src/map/facilityMarkers';
import { places } from './fixtures/places';

const marker = { categoryCode: 'F012', priority: 1 } as FacilityMarkerCandidate;
const place = { ...places[0], id: 'gate' };

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

  it('uses compact gate icons at overview scale and full labels at detail scale', () => {
    expect(placeMarkerDetail(place, '', '', true, false)).toBe('icon');
    expect(placeMarkerDetail(place, '', '', true, true)).toBe('label');
    expect(placeMarkerDetail(place, '', '', false, false)).toBeUndefined();
    expect(placeMarkerDetail({ ...place, category: 'toilet' }, '', '', true, false)).toBeUndefined();
  });

  it('keeps active endpoints labelled at overview scale and with gates disabled', () => {
    expect(placeMarkerDetail(place, 'gate', '', true, false)).toBe('label');
    expect(placeMarkerDetail(place, '', 'gate', true, false)).toBe('label');
    expect(placeMarkerDetail({ ...place, id: 'toilet', category: 'toilet' }, 'toilet', '', false, false)).toBe('label');
  });
});
