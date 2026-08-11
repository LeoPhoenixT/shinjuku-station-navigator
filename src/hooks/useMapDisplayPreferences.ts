import { useMemo, useState } from 'react';
import { facilityMarkerMatchesPreferences, HIDDEN_MARKER_CATEGORY_CODES } from '../map/displayPreferences.js';
import type { FacilityMarkerCandidate } from '../map/facilityMarkers.js';
import { useI18n } from '../i18n/context.js';
import { formatIndoorMapCategory } from '../i18n/formatters.js';

export const GATE_CATEGORY_CODE = 'named-place:gate';
export const EXIT_CATEGORY_CODE = 'F108';

export function buildDefaultFacilityCategoryCodes(): Set<string> {
  return new Set([GATE_CATEGORY_CODE, EXIT_CATEGORY_CODE]);
}

export interface FacilityCategoryOption {
  code: string;
  label: string;
  count: number;
}

export function useMapDisplayPreferences(
  facilityMarkerCandidates: FacilityMarkerCandidate[],
  routableGateCount: number,
) {
  const { locale, t } = useI18n();
  const [debug, setDebug] = useState(false);
  const [showAllSourceLinks, setShowAllSourceLinks] = useState(false);
  const [showOfficialNetwork, setShowOfficialNetwork] = useState(false);
  const [showOfficialNodes, setShowOfficialNodes] = useState(false);
  const [showTwsi, setShowTwsi] = useState(false);
  const [showFacilities, setShowFacilities] = useState(true);
  const [showStructuralDetails, setShowStructuralDetails] = useState(true);
  const defaultFacilityCategoryCodes = useMemo(buildDefaultFacilityCategoryCodes, []);
  const [enabledFacilityCategories, setEnabledFacilityCategories] = useState<Set<string>>(
    () => new Set(defaultFacilityCategoryCodes),
  );
  const filteredFacilityCandidates = useMemo(
    () => facilityMarkerCandidates.filter((marker) => facilityMarkerMatchesPreferences(marker, enabledFacilityCategories)),
    [enabledFacilityCategories, facilityMarkerCandidates],
  );
  const facilityCategories = useMemo<FacilityCategoryOption[]>(() => {
    const categories = new Map<string, FacilityCategoryOption>();
    for (const marker of facilityMarkerCandidates.filter(
      ({ status, categoryCode }) => status === 'public' && !HIDDEN_MARKER_CATEGORY_CODES.has(categoryCode),
    )) {
      const current = categories.get(marker.categoryCode);
      categories.set(marker.categoryCode, {
        code: marker.categoryCode,
        label: formatIndoorMapCategory('Facility', marker.categoryCode, locale),
        count: (current?.count ?? 0) + 1,
      });
    }
    categories.set(GATE_CATEGORY_CODE, {
      code: GATE_CATEGORY_CODE,
      label: t('category.ticketGates'),
      count: routableGateCount,
    });
    return [...categories.values()].sort(
      (a, b) => a.label.localeCompare(b.label, locale) || a.code.localeCompare(b.code),
    );
  }, [facilityMarkerCandidates, locale, routableGateCount, t]);

  const toggleFacilityCategory = (code: string) => {
    setEnabledFacilityCategories((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  return {
    debug,
    setDebug,
    showAllSourceLinks,
    setShowAllSourceLinks,
    showOfficialNetwork,
    setShowOfficialNetwork,
    showOfficialNodes,
    setShowOfficialNodes,
    showTwsi,
    setShowTwsi,
    showFacilities,
    setShowFacilities,
    showStructuralDetails,
    setShowStructuralDetails,
    defaultFacilityCategoryCodes,
    enabledFacilityCategories,
    filteredFacilityCandidates,
    facilityCategories,
    toggleFacilityCategory,
    showAllFacilityCategories: () => setEnabledFacilityCategories(new Set(facilityCategories.map(({ code }) => code))),
    clearAllFacilityCategories: () => setEnabledFacilityCategories(new Set()),
    resetFacilityCategories: () => setEnabledFacilityCategories(new Set(defaultFacilityCategoryCodes)),
  };
}
