import type { RoutePlan } from '../routing/routeService.js';
import type { NamedPlaceRecord } from '../schema/processed.js';
import type { ProcessedFeature } from '../types/processed.js';
import type { FacilityMarkerCandidate } from './facilityMarkers.js';
import { SPACE_PRESENTATION_STYLES, spacePresentationStyle } from './spacePresentation.js';
import { STRUCTURAL_LINE_STYLES } from './structuralLinePresentation.js';
import type { NetworkContext } from './networkContext.js';
import { translate, type Locale } from '../i18n/types.js';
import { formatIndoorMapCategory } from '../i18n/formatters.js';

export type MapLegendItemKind = 'surface' | 'line' | 'marker' | 'route' | 'network' | 'debug';
export type MapLegendSection = 'route' | 'spaces' | 'facilities' | 'structure' | 'network' | 'debug';

export interface MapLegendItem {
  id: string;
  section: MapLegendSection;
  label: string;
  kind: MapLegendItemKind;
  color: string;
  symbol?: string;
  emphasis?: 'restricted' | 'vertical' | 'one-way' | 'priority-2' | 'priority-3';
}

export interface MapLegendState {
  features: ProcessedFeature[];
  facilityCandidates: FacilityMarkerCandidate[];
  places: NamedPlaceRecord[];
  visibleFloors: string[];
  route: RoutePlan;
  startId: string;
  destinationId: string;
  showFacilities: boolean;
  showStructuralDetails: boolean;
  showOfficialNetwork: boolean;
  networkContexts: NetworkContext[];
  hasOneWayNetwork: boolean;
  debug: boolean;
  showAllSourceLinks?: boolean;
  showTwsi: boolean;
  locale?: Locale;
}

const SPACE_LABEL_KEYS = {
  walkway: 'legend.walkway', room: 'legend.room', retail: 'legend.retail', office: 'legend.office', waiting: 'legend.waiting', ticket: 'legend.ticket', information: 'legend.information',
  toilet: 'legend.toilet', 'multipurpose-toilet': 'legend.multipurposeToilet', stairs: 'legend.stairs', elevator: 'legend.elevator', escalator: 'legend.escalator', 'moving-walkway': 'legend.movingWalkway',
  slope: 'legend.slope', platform: 'legend.platform', restricted: 'legend.restricted', outdoor: 'legend.outdoor', barrier: 'legend.barrier', unknown: 'legend.otherSpace',
} as const;

const SECTION_ORDER: MapLegendSection[] = ['route', 'spaces', 'facilities', 'structure', 'network', 'debug'];

function spaceLabel(group: string, locale: Locale): string {
  const key = SPACE_LABEL_KEYS[group as keyof typeof SPACE_LABEL_KEYS];
  return key ? translate(locale, key) : group;
};

function hasVisibleLayer(features: ProcessedFeature[], visibleFloors: Set<string>, layer: ProcessedFeature['layer']): boolean {
  return features.some((feature) => feature.layer === layer && visibleFloors.has(feature.floorId ?? 'B1'));
}

function routeUsesVisibleFloor(route: RoutePlan, visibleFloors: Set<string>, transition: boolean): boolean {
  if (route.status !== 'ok') return false;
  return route.steps.some((step) => transition
    ? step.floorFrom !== step.floorTo && visibleFloors.has(step.floorFrom) && visibleFloors.has(step.floorTo)
    : step.floorFrom === step.floorTo && visibleFloors.has(step.floorFrom));
}

export function buildMapLegendItems(state: MapLegendState): MapLegendItem[] {
  const locale = state.locale ?? 'en';
  const visibleFloors = new Set(state.visibleFloors);
  const items: MapLegendItem[] = [];
  if (routeUsesVisibleFloor(state.route, visibleFloors, false)) items.push({ id: 'route', section: 'route', label: translate(locale, 'legend.sameFloorRoute'), kind: 'route', color: '#fb923c' });
  if (routeUsesVisibleFloor(state.route, visibleFloors, true)) items.push({ id: 'transition', section: 'route', label: translate(locale, 'legend.floorTransition'), kind: 'route', color: '#22c55e' });
  const start = state.places.find(({ id }) => id === state.startId);
  const destination = state.places.find(({ id }) => id === state.destinationId);
  if (start && visibleFloors.has(start.floorId)) items.push({ id: 'start', section: 'route', label: translate(locale, 'legend.start'), kind: 'marker', color: '#22c55e', symbol: 'S' });
  if (destination && visibleFloors.has(destination.floorId)) items.push({ id: 'destination', section: 'route', label: translate(locale, 'legend.destination'), kind: 'marker', color: '#ef4444', symbol: 'D' });

  const visibleSpaceGroups = new Set(state.features.filter((feature) => feature.layer === 'Space' && visibleFloors.has(feature.floorId ?? 'B1')).map((feature) => spacePresentationStyle(feature.properties.category).group));
  for (const style of SPACE_PRESENTATION_STYLES) {
    if (!visibleSpaceGroups.has(style.group)) continue;
    items.push({ id: `space:${style.group}`, section: 'spaces', label: spaceLabel(style.group, locale), kind: 'surface', color: style.color, emphasis: style.emphasis === 'none' ? undefined : style.emphasis });
  }

  if (state.showFacilities) {
    const markerKeys = new Set<string>();
    for (const marker of state.facilityCandidates.filter(({ status, floorId }) => status === 'public' && visibleFloors.has(floorId)).sort((a, b) => a.priority - b.priority || a.categoryName.localeCompare(b.categoryName) || a.id.localeCompare(b.id))) {
      const categoryName = formatIndoorMapCategory('Facility', marker.categoryCode, locale);
      const key = `${marker.icon}:${categoryName}`;
      if (markerKeys.has(key)) continue;
      markerKeys.add(key);
      items.push({ id: `facility:${marker.categoryCode}`, section: 'facilities', label: categoryName, kind: 'marker', color: marker.priority === 1 ? '#7dd3fc' : marker.priority === 2 ? '#a78bfa' : '#94a3b8', symbol: marker.icon, emphasis: marker.priority === 1 ? undefined : marker.priority === 2 ? 'priority-2' : 'priority-3' });
    }
  }

  if (hasVisibleLayer(state.features, visibleFloors, 'Opening')) items.push({ id: 'opening', section: 'structure', label: translate(locale, 'legend.opening'), kind: 'line', color: STRUCTURAL_LINE_STYLES.openingActive.color });
  if (state.showStructuralDetails && hasVisibleLayer(state.features, visibleFloors, 'Drawing')) items.push({ id: 'drawing', section: 'structure', label: translate(locale, 'legend.structuralDrawing'), kind: 'line', color: STRUCTURAL_LINE_STYLES.drawingActive.color });
  if (state.features.some((feature) => visibleFloors.has(feature.floorId ?? 'B1') && typeof feature.properties.sourceFloor === 'string' && feature.properties.sourceFloor.endsWith('out'))) items.push({ id: 'outdoor', section: 'structure', label: translate(locale, 'legend.outdoorContext'), kind: 'line', color: STRUCTURAL_LINE_STYLES.outdoorActive.color });

  if (state.showOfficialNetwork) {
    const networkStyles: Record<NetworkContext, { label: string; color: string }> = { inside: { label: translate(locale, 'legend.inside'), color: '#38bdf8' }, boundary: { label: translate(locale, 'legend.boundary'), color: '#f59e0b' }, outside: { label: translate(locale, 'legend.outside'), color: '#c084fc' } };
    for (const context of ['inside', 'boundary', 'outside'] as const) if (state.networkContexts.includes(context)) items.push({ id: `network:${context}`, section: 'network', label: networkStyles[context].label, kind: 'network', color: networkStyles[context].color });
    if (state.hasOneWayNetwork) items.push({ id: 'network:one-way', section: 'network', label: translate(locale, 'legend.oneWay'), kind: 'network', color: '#fef08a', symbol: '▲', emphasis: 'one-way' });
  }
  if (state.debug && state.showAllSourceLinks) items.push({ id: 'network:all-source', section: 'debug', label: translate(locale, 'settings.allSourceLinks'), kind: 'debug', color: '#22d3ee' });
  if (state.debug && state.showTwsi && hasVisibleLayer(state.features, visibleFloors, 'TWSI_Line')) items.push({ id: 'twsi', section: 'debug', label: translate(locale, 'settings.twsi'), kind: 'debug', color: '#84cc16' });
  return items.sort((a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section) || a.id.localeCompare(b.id));
}

export function groupMapLegendItems(items: MapLegendItem[]): Array<{ section: MapLegendItem['section']; items: MapLegendItem[] }> {
  return SECTION_ORDER.map((section) => ({ section, items: items.filter((item) => item.section === section) })).filter(({ items }) => items.length > 0);
}
