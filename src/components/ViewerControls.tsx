import { useCallback, useEffect, useId, useState, type KeyboardEvent } from 'react';
import { findPlaceByDisplayName, groupPlacesByFloorArea, placeDisplayName, searchPlaces } from '../features/route-planner/placeSearch.js';
import { categoryDisplayName, placeSecondaryText, publicPlaceName } from '../places/placePresentation.js';
import type { NamedPlaceRecord } from '../schema/processed.js';
import type { RoutePlan } from '../routing/routeService.js';
import type { RoutingProfile } from '../routing/pathfinding.js';
import { estimateJourney, estimatedTimeText } from '../routing/journeyEstimate.js';
import { MapToolbar } from './MapToolbar.js';
import { MapLegend } from './MapLegend.js';
import { RouteSheet } from './RouteSheet.js';
import type { MapLegendItem } from '../map/mapLegend.js';
import type { FloorViewMode } from '../map/displayPreferences.js';
import { useI18n } from '../i18n/context.js';
import { translate, type Locale } from '../i18n/types.js';
import { floorLongName } from '../places/placePresentation.js';
import type { PlaceTranslationsDataset } from '../schema/placeTranslations.js';

interface ViewerControlsProps {
  debug: boolean;
  setDebug: (value: boolean) => void;
  showAllSourceLinks: boolean;
  setShowAllSourceLinks: (value: boolean) => void;
  places: NamedPlaceRecord[];
  translations?: PlaceTranslationsDataset;
  startId: string;
  destinationId: string;
  setStartId: (id: string) => void;
  setDestinationId: (id: string) => void;
  swapPlaces: () => void;
  clearRoute: () => void;
  route: RoutePlan;
  profile: RoutingProfile;
  setProfile: (profile: RoutingProfile) => void;
  routeDirty: boolean;
  submitRoute: () => void;
  showOfficialNetwork: boolean;
  setShowOfficialNetwork: (value: boolean) => void;
  showOfficialNodes: boolean;
  setShowOfficialNodes: (value: boolean) => void;
  showTwsi: boolean;
  setShowTwsi: (value: boolean) => void;
  showFacilities: boolean;
  setShowFacilities: (value: boolean) => void;
  facilityCategories: Array<{ code: string; label: string; count: number }>;
  enabledFacilityCategories: ReadonlySet<string>;
  toggleFacilityCategory: (code: string) => void;
  showAllFacilityCategories: () => void;
  clearAllFacilityCategories: () => void;
  resetFacilityCategories: () => void;
  showStructuralDetails: boolean;
  setShowStructuralDetails: (value: boolean) => void;
  floorIds: string[];
  visibleFloors: string[];
  routeFloorIds: string[];
  activeFloor: string;
  floorViewMode: FloorViewMode;
  selectFloor: (floorId: string) => void;
  showStack: () => void;
  showRouteFloors: () => void;
  toggleCustomFloor: (floorId: string) => void;
  rotationEnabled: boolean;
  setRotationEnabled: (value: boolean) => void;
  fitRoute: () => void;
  fitStation: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  showNorthView: () => void;
  showAngledView: () => void;
  cameraHeading: number;
  selectedStepIndex?: number;
  onStepSelect: (index: number) => void;
  interactionMessage?: string;
  legendItems: MapLegendItem[];
}

function routeMessage(route: RoutePlan, locale: Locale): string {
  if (route.status === 'ok') return translate(locale, 'route.status.networkAccess', { network: route.network.distanceMeters.toFixed(1), access: route.accessDistanceMeters.toFixed(1) });
  if (route.status === 'outside-coverage') return translate(locale, 'route.status.outsideCoverage');
  if (route.status === 'unreachable') return translate(locale, route.reason === 'no-accessible-path' ? 'route.status.noAccessiblePath' : route.reason === 'no-stair-free-path' ? 'route.status.noStairFreePath' : 'route.status.noDirectedPath');
  return translate(locale, route.reason === 'low-confidence-attachment' ? 'route.status.attachmentReview' : route.placeId.length === 0 ? 'route.status.chooseEndpoints' : 'route.status.invalidSelection');
}

function PlaceSearchInput({ kind, places, translations, value, onChange }: { kind: 'start' | 'destination'; places: NamedPlaceRecord[]; translations?: PlaceTranslationsDataset; value: string; onChange: (id: string) => void }) {
  const { locale, t } = useI18n();
  const label = t(kind === 'start' ? 'planner.start' : 'planner.destination');
  const searchLabel = locale === 'en' ? label.toLocaleLowerCase('en') : label;
  const listId = useId();
  const inputId = useId();
  const selected = places.find((place) => place.id === value);
  const [query, setQuery] = useState(selected ? placeDisplayName(selected, locale, translations) : value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [category, setCategory] = useState<NamedPlaceRecord['category'] | 'all'>('all');
  const selectedText = selected ? placeDisplayName(selected, locale, translations) : value;
  const searchTerm = open && query === selectedText ? '' : query;
  const allResults = searchPlaces(places, searchTerm, locale, translations).filter((place) => category === 'all' || place.category === category);
  const visibleResults = allResults.slice(0, 100);
  const groups = groupPlacesByFloorArea(visibleResults, locale, translations);
  const matches = groups.flatMap((group) => group.places);

  useEffect(() => setQuery(selected ? placeDisplayName(selected, locale, translations) : value), [locale, selected, translations, value]);

  const choose = (place: NamedPlaceRecord) => {
    onChange(place.id);
    setQuery(placeDisplayName(place, locale, translations));
    setOpen(false);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, Math.max(0, matches.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter' && open && matches[activeIndex]) {
      event.preventDefault();
      choose(matches[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setQuery(selected ? placeDisplayName(selected, locale, translations) : value);
    }
  };

  const categoryShortcuts = ([
    ['gate', t('search.gates')], ['exit', t('search.exits')], ['toilet', t('search.toilets')], ['elevator', t('search.elevators')], ['locker', t('search.lockers')],
  ] as const).filter(([candidate]) => places.some((place) => place.routable && place.category === candidate));

  return <div className="place-search"><label htmlFor={inputId}>{label}</label>
    <input
      id={inputId}
      type="search"
      role="combobox"
      aria-label={t('search.inputLabel', { label: searchLabel })}
      aria-autocomplete="list"
      aria-controls={listId}
      aria-expanded={open}
      aria-activedescendant={open && matches[activeIndex] ? `${listId}-${activeIndex}` : undefined}
      value={query}
      placeholder={t('search.placeholder')}
      onFocus={() => setOpen(true)}
      onKeyDown={handleKeyDown}
      onChange={(event) => {
        const next = event.target.value;
        setQuery(next);
        setOpen(true);
        setActiveIndex(0);
        if (next.length === 0) onChange('');
        const exact = findPlaceByDisplayName(places, next, locale, translations);
        if (exact) onChange(exact.id);
      }}
      onBlur={() => {
        setOpen(false);
        setQuery(selected ? placeDisplayName(selected, locale, translations) : value);
      }}
      autoComplete="off"
    />
    {open && categoryShortcuts.length > 1 && <div className="place-shortcuts" role="group" aria-label={t('search.categories', { label })}>
      <button type="button" aria-pressed={category === 'all'} onMouseDown={(event) => event.preventDefault()} onClick={() => { setCategory('all'); setActiveIndex(0); }}>{t('search.all')}</button>
      {categoryShortcuts.map(([candidate, text]) => <button type="button" key={candidate} aria-pressed={category === candidate} onMouseDown={(event) => event.preventDefault()} onClick={() => { setCategory(candidate); setActiveIndex(0); }}>{text}</button>)}
    </div>}
    {open && matches.length > 0 && <ul className="place-options" id={listId} role="listbox">
      {allResults.length > visibleResults.length && <li className="place-option-limit" role="status">{t('search.limit', { count: allResults.length })}</li>}
      {groups.map((group) => {
        const floor = floorLongName(group.floorId, locale);
        const categoryName = categoryDisplayName(group.category, locale);
        return <li className="place-option-group" key={`${group.floorId}:${group.areaId}:${group.category}`} role="group" aria-label={t('search.group', { floor, area: group.area, category: categoryName })}>
        <div className="place-option-heading"><strong>{floor}</strong><span>{group.area} · {categoryName}</span></div>
        {group.places.map((place) => {
          const index = matches.findIndex((match) => match.id === place.id);
          return <div
            className="place-option"
            id={`${listId}-${index}`}
            key={place.id}
            role="option"
            aria-selected={index === activeIndex}
            onMouseDown={(event) => { event.preventDefault(); choose(place); }}
          ><strong>{publicPlaceName(place, locale, translations)}</strong><span>{placeSecondaryText(place, locale, translations)}</span></div>;
        })}
      </li>;
      })}
    </ul>}
  </div>;
}

export function ViewerControls(props: ViewerControlsProps) {
  const { locale, t } = useI18n();
  const routablePlaces = props.places.filter(({ routable }) => routable);
  const [shareMessage, setShareMessage] = useState<string>();
  const [narrow] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches);
  const [expandedPanels, setExpandedPanels] = useState<Set<'planner' | 'directions' | 'settings' | 'legend'>>(() => {
    const panels = new Set<'planner' | 'directions' | 'settings' | 'legend'>();
    if (props.route.status !== 'ok' && !narrow) panels.add('planner');
    return panels;
  });
  const panelOpen = (panel: 'planner' | 'directions' | 'settings' | 'legend') => expandedPanels.has(panel);
  const setPanelOpen = useCallback((panel: 'planner' | 'directions' | 'settings' | 'legend', open: boolean) => setExpandedPanels((current) => {
    if (narrow && open) return new Set([panel]);
    const next = new Set(current);
    if (open) next.add(panel); else next.delete(panel);
    return next;
  }), [narrow]);
  const plannerOpen = panelOpen('planner');
  useEffect(() => {
    if (!shareMessage) return;
    const timeout = window.setTimeout(() => setShareMessage(undefined), 2800);
    return () => window.clearTimeout(timeout);
  }, [shareMessage]);
  useEffect(() => {
    if (props.route.status === 'ok') setPanelOpen('planner', false);
  }, [props.route, setPanelOpen]);
  const copyRouteLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareMessage(t('route.shareCopied'));
    } catch {
      setShareMessage(t('route.shareUnavailable'));
    }
  };
  const routeSummary = props.route.status === 'ok'
    ? t('route.summary', {
      start: publicPlaceName(props.route.start, locale, props.translations),
      destination: publicPlaceName(props.route.destination, locale, props.translations),
      time: estimatedTimeText(estimateJourney(props.route), locale),
      distance: props.route.totalDistanceMeters.toFixed(1),
    })
    : props.startId || props.destinationId ? t('planner.summary.complete') : t('planner.title');
  const emptyRequest = props.route.status === 'invalid-place' && props.route.placeId.length === 0;

  return <div className="route-controls">
    <MapToolbar
      floorIds={props.floorIds} visibleFloors={props.visibleFloors} routeFloorIds={props.routeFloorIds} activeFloor={props.activeFloor} floorViewMode={props.floorViewMode} selectFloor={props.selectFloor} showStack={props.showStack} showRouteFloors={props.showRouteFloors} toggleCustomFloor={props.toggleCustomFloor}
      canFitRoute={props.route.status === 'ok'} fitRoute={props.fitRoute} fitStation={props.fitStation} zoomIn={props.zoomIn} zoomOut={props.zoomOut} showNorthView={props.showNorthView} showAngledView={props.showAngledView}
      cameraHeading={props.cameraHeading}
      rotationEnabled={props.rotationEnabled} setRotationEnabled={props.setRotationEnabled}
      showFacilities={props.showFacilities} setShowFacilities={props.setShowFacilities} facilityCategories={props.facilityCategories} enabledFacilityCategories={props.enabledFacilityCategories} toggleFacilityCategory={props.toggleFacilityCategory} showAllFacilityCategories={props.showAllFacilityCategories} clearAllFacilityCategories={props.clearAllFacilityCategories} resetFacilityCategories={props.resetFacilityCategories} showStructuralDetails={props.showStructuralDetails} setShowStructuralDetails={props.setShowStructuralDetails}
      debug={props.debug} setDebug={props.setDebug} showAllSourceLinks={props.showAllSourceLinks} setShowAllSourceLinks={props.setShowAllSourceLinks} showOfficialNetwork={props.showOfficialNetwork} setShowOfficialNetwork={props.setShowOfficialNetwork} showOfficialNodes={props.showOfficialNodes} setShowOfficialNodes={props.setShowOfficialNodes} showTwsi={props.showTwsi} setShowTwsi={props.setShowTwsi}
      settingsOpen={panelOpen('settings')} onSettingsOpenChange={(open) => setPanelOpen('settings', open)}
    />
    <div className="journey-stack">
      <MapLegend items={props.legendItems} open={panelOpen('legend')} onOpenChange={(open) => setPanelOpen('legend', open)} />
      {(plannerOpen || props.route.status !== 'ok') ? <section className={`planner-card ${plannerOpen ? '' : 'planner-card-collapsed'} ${emptyRequest && !plannerOpen ? 'planner-card-empty' : ''}`} aria-label={t('planner.label')}>
        <header className="planner-header">
          <span><span className="planner-kicker">{t('planner.kicker')}</span><strong>{t('planner.title')}</strong></span>
          <span className="planner-summary" title={routeSummary}>{(props.startId || props.destinationId) ? routeSummary : ''}</span>
          <button type="button" className="planner-toggle" aria-label={t(plannerOpen ? 'planner.actions.hideLabel' : 'planner.actions.edit')} aria-expanded={plannerOpen} aria-controls="planner-body" onClick={() => setPanelOpen('planner', !plannerOpen)}>{t(plannerOpen ? 'planner.actions.hide' : 'planner.actions.edit')}</button>
        </header>
        {plannerOpen && <div className="planner-body" id="planner-body">
          <div className="place-row">
            <PlaceSearchInput kind="start" places={routablePlaces} translations={props.translations} value={props.startId} onChange={props.setStartId} />
            <button type="button" className="swap-places" onClick={props.swapPlaces} aria-label={t('planner.actions.swap')} title={t('planner.actions.swap')}>⇄</button>
            <PlaceSearchInput kind="destination" places={routablePlaces} translations={props.translations} value={props.destinationId} onChange={props.setDestinationId} />
          </div>
          <div className="planner-actions">
            <label className="profile-control"><span>{t('planner.routeField')}</span><select aria-label={t('profile.label')} value={props.profile} onChange={(event) => props.setProfile(event.target.value as RoutingProfile)}><option value="shortest">{t('profile.shortest')}</option><option value="accessible">{t('profile.accessible')}</option><option value="avoid-stairs">{t('profile.avoidStairs')}</option><option value="prefer-elevator">{t('profile.preferElevator')}</option><option value="fewest-floor-changes">{t('profile.fewestFloorChanges')}</option></select></label>
            <button type="button" className="submit-route" onClick={props.submitRoute} disabled={!props.startId || !props.destinationId || !props.routeDirty}>{t(props.route.status === 'ok' ? 'planner.actions.update' : 'planner.actions.show')}</button>
            <button type="button" className="clear-route" onClick={props.clearRoute} disabled={!props.startId && !props.destinationId && props.route.status !== 'ok'}>{t('planner.actions.clear')}</button>
            <button type="button" className="share-route" onClick={() => void copyRouteLink()} disabled={!props.startId || !props.destinationId}>{t('planner.actions.share')}</button>
          </div>
          <p className={`planner-status ${props.route.status === 'ok' || emptyRequest ? '' : 'planner-status-error'}`} role={props.route.status === 'ok' || emptyRequest ? 'status' : 'alert'}>{routeMessage(props.route, locale)}</p>
        </div>}
      </section> : <RouteSheet route={props.route} translations={props.translations} selectedStepIndex={props.selectedStepIndex} onStepSelect={props.onStepSelect} expanded={panelOpen('directions')} onExpandedChange={(open) => setPanelOpen('directions', open)} onEditRoute={() => setPanelOpen('planner', true)} />}
    </div>
    {(shareMessage || props.interactionMessage) && <div className="app-toast" role="status">{shareMessage || props.interactionMessage}</div>}
  </div>;
}
