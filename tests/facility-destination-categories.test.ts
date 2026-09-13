import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FACILITY_CATEGORIES, FACILITY_NAMED_PLACE_POLICIES, resolveFacilityNamedPlacePolicy } from '../src/data/indoorMapCategories';
import { buildFacilityMarkerCandidates } from '../src/map/facilityMarkers';
import type { NamedPlacesDataset, OfficialNetworkDataset } from '../src/schema/processed';
import { parseFloorDataset } from '../src/schema/processed';

const fullMap = parseFloorDataset(JSON.parse(readFileSync('public/data/processed/shinjuku-full-map.json', 'utf8')));
const network = JSON.parse(readFileSync('public/data/processed/jr-shinjuku-ticket-gates-b1-official-network.json', 'utf8')) as OfficialNetworkDataset;
const places = JSON.parse(readFileSync('public/data/processed/shinjuku-b1-named-places.json', 'utf8')) as NamedPlacesDataset;

describe('Facility destination category registry', () => {
  it('maps or explicitly excludes every destination-eligible category, while preserving every public Facility promotion', () => {
    const eligibleCodes = FACILITY_CATEGORIES
      .filter(({ destinationEligible }) => destinationEligible)
      .map(({ code }) => code)
      .sort();
    expect(Object.keys(FACILITY_NAMED_PLACE_POLICIES).sort()).toEqual(eligibleCodes);

    const policies = new Map(eligibleCodes.map((code) => [code, resolveFacilityNamedPlacePolicy(code)]));
    for (const [code, policy] of policies) {
      expect(policy, `${code} needs a named-place mapping or an explicit exclusion`).toBeDefined();
      expect(Boolean(policy?.namedPlaceCategory) || Boolean(policy?.exclusionReason), `${code} needs exactly one promotion decision`).toBe(true);
      expect(Boolean(policy?.namedPlaceCategory) === Boolean(policy?.exclusionReason), `${code} cannot be both promoted and excluded`).toBe(false);
    }

    const candidates = buildFacilityMarkerCandidates(
      fullMap.features,
      network.nodes.map((node) => ({ id: node.id, floorId: node.floorId, x: node.coordinates[0], z: node.coordinates[2] })),
    );
    const publicDestinationCodes = [...new Set(candidates
      .filter((candidate) => candidate.status === 'public' && policies.has(candidate.categoryCode))
      .map((candidate) => candidate.categoryCode))]
      .sort();
    const publicPromotedCodes = publicDestinationCodes
      .filter((code) => Boolean(policies.get(code)?.namedPlaceCategory));
    const promotedCodes = [...new Set(places.places
      .filter((place) => place.sourceLayer === 'Facility')
      .map((place) => place.sourceCategoryCode!))]
      .sort();
    const selectedCandidateIds = candidates
      .filter((candidate) => candidate.status === 'public' && Boolean(policies.get(candidate.categoryCode)?.namedPlaceCategory))
      .map((candidate) => `facility:${candidate.id.slice('facility-marker:'.length)}`)
      .sort();
    const promotedPlaceIds = places.places
      .filter((place) => place.sourceLayer === 'Facility')
      .map((place) => place.id)
      .sort();

    expect(publicDestinationCodes.every((code) => Boolean(policies.get(code)?.namedPlaceCategory) || Boolean(policies.get(code)?.exclusionReason))).toBe(true);
    expect(promotedCodes).toEqual(publicPromotedCodes);
    expect(promotedPlaceIds).toEqual(selectedCandidateIds);
    for (const place of places.places.filter((entry) => entry.sourceLayer === 'Facility')) {
      expect(place.category).toBe(policies.get(place.sourceCategoryCode!)?.namedPlaceCategory);
    }
    expect(resolveFacilityNamedPlacePolicy('F038')).toEqual({ exclusionReason: 'outside-current-named-place-taxonomy' });
  });
});
