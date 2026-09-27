import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { buildPlaceIdIndex, buildPlaceSearchIndex, groupPlacesByFloorArea, placeDisplayName, type PlaceSearchIndex } from '../features/route-planner/placeSearch.js';
import { categoryDisplayName, placeSecondaryText, publicPlaceName } from '../places/placePresentation.js';
import type { NamedPlaceRecord } from '../schema/processed.js';
import type { RoutePlan } from '../routing/routeService.js';
import { estimateJourney, estimatedTimeText } from '../routing/journeyEstimate.js';
import { MapToolbar } from './MapToolbar.js';
import { MapLegend } from './MapLegend.js';
import { RouteSheet } from './RouteSheet.js';
import { useI18n } from '../i18n/context.js';
import { translate, type Locale } from '../i18n/types.js';
import { floorLongName } from '../places/placePresentation.js';
import type { PlaceTranslationsDataset } from '../schema/placeTranslations.js';
import type { PlannerViewModel, ViewerDisplayViewModel, ViewerFeedbackViewModel, ViewerLegendViewModel, ViewerNavigationViewModel } from './viewerViewModels.js';

export interface ViewerControlsProps {
  readonly planner: PlannerViewModel;
  readonly navigation: ViewerNavigationViewModel;
  readonly display: ViewerDisplayViewModel;
  readonly feedback: ViewerFeedbackViewModel;
  readonly legend: ViewerLegendViewModel;
}

function routeMessage(route: RoutePlan, locale: Locale): string {
  if (route.status === 'ok') return translate(locale, 'route.status.networkAccess', { network: route.network.distanceMeters.toFixed(1), access: route.accessDistanceMeters.toFixed(1) });
  if (route.status === 'outside-coverage') return translate(locale, 'route.status.outsideCoverage');
  if (route.status === 'unreachable') return translate(locale, route.reason === 'no-accessible-path' ? 'route.status.noAccessiblePath' : route.reason === 'no-stair-free-path' ? 'route.status.noStairFreePath' : 'route.status.noDirectedPath');
  return translate(locale, route.reason === 'low-confidence-attachment' ? 'route.status.attachmentReview' : route.placeId.length === 0 ? 'route.status.chooseEndpoints' : 'route.status.invalidSelection');
}

function PlaceSearchInput({ kind, searchIndex, translations, value, onChange }: { kind: 'start' | 'destination'; searchIndex: PlaceSearchIndex; translations?: PlaceTranslationsDataset; value: string; onChange: (id: string) => void }) {
  const { locale, t } = useI18n();
  const label = t(kind === 'start' ? 'planner.start' : 'planner.destination');
  const searchLabel = locale === 'en' ? label.toLocaleLowerCase('en') : label;
  const listId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = searchIndex.findById(value);
  const [query, setQuery] = useState(selected ? placeDisplayName(selected, locale, translations) : value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [category, setCategory] = useState<NamedPlaceRecord['category'] | 'all'>('all');
  const selectedText = selected ? placeDisplayName(selected, locale, translations) : value;
  const searchTerm = open && query === selectedText ? '' : query;
  const allResults = useMemo(
    () => searchIndex.search(searchTerm, locale).filter((place) => category === 'all' || place.category === category),
    [category, locale, searchIndex, searchTerm],
  );
  const visibleResults = useMemo(() => allResults.slice(0, 100), [allResults]);
  const groups = useMemo(() => groupPlacesByFloorArea(visibleResults, locale, translations), [locale, translations, visibleResults]);
  const matches = useMemo(() => groups.flatMap((group) => group.places), [groups]);
  const matchIndexById = useMemo(() => buildPlaceIdIndex(matches), [matches]);

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
    }
  };

  const categoryShortcuts = ([
    ['gate', t('search.gates')], ['exit', t('search.exits')], ['toilet', t('search.toilets')], ['elevator', t('search.elevators')], ['locker', t('search.lockers')],
  ] as const).filter(([candidate]) => searchIndex.categories.includes(candidate));

  return <div className="place-search" onBlur={(event) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    setOpen(false);
    setQuery(selectedText);
  }} onKeyDown={(event) => {
    if (event.key !== 'Escape') return;
    inputRef.current?.focus();
    setOpen(false);
    setQuery(selectedText);
  }}><label htmlFor={inputId}>{label}</label>
    <input
      ref={inputRef}
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
        const exact = searchIndex.findByDisplayName(next, locale);
        if (exact) onChange(exact.id);
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
          const index = matchIndexById.indexOf(place.id)!;
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
  const { planner, navigation, display, feedback, legend } = props;
  const { camera } = navigation;
  const { locale, t } = useI18n();
  const routablePlaces = useMemo(() => planner.places.filter(({ routable }) => routable), [planner.places]);
  const placeSearchIndex = useMemo(() => buildPlaceSearchIndex(routablePlaces, planner.translations), [planner.translations, routablePlaces]);
  const [shareMessage, setShareMessage] = useState<string>();
  const [narrow] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches);
  const [expandedPanels, setExpandedPanels] = useState<Set<'planner' | 'directions' | 'settings' | 'legend'>>(() => {
    const panels = new Set<'planner' | 'directions' | 'settings' | 'legend'>();
    if (planner.route.status !== 'ok' && !narrow) panels.add('planner');
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
    if (planner.route.status === 'ok') setPanelOpen('planner', false);
  }, [planner.route, setPanelOpen]);
  const copyRouteLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareMessage(t('route.shareCopied'));
    } catch {
      setShareMessage(t('route.shareUnavailable'));
    }
  };
  const routeSummary = planner.route.status === 'ok'
    ? t('route.summary', {
      start: publicPlaceName(planner.route.start, locale, planner.translations),
      destination: publicPlaceName(planner.route.destination, locale, planner.translations),
      time: estimatedTimeText(estimateJourney(planner.route), locale),
      distance: planner.route.totalDistanceMeters.toFixed(1),
    })
    : planner.startId || planner.destinationId ? t('planner.summary.complete') : t('planner.title');
  const emptyRequest = planner.route.status === 'invalid-place' && planner.route.placeId.length === 0;

  return <div className="route-controls">
    <MapToolbar
      navigation={navigation} display={display} canFitRoute={planner.route.status === 'ok'}
      settingsOpen={panelOpen('settings')} onSettingsOpenChange={(open) => setPanelOpen('settings', open)}
    />
    <div className="journey-stack">
      <MapLegend items={legend.items} open={panelOpen('legend')} onOpenChange={(open) => setPanelOpen('legend', open)} />
      {(plannerOpen || planner.route.status !== 'ok') ? <section className={`planner-card ${plannerOpen ? '' : 'planner-card-collapsed'} ${emptyRequest && !plannerOpen ? 'planner-card-empty' : ''}`} aria-label={t('planner.label')}>
        <header className="planner-header">
          <span><span className="planner-kicker">{t('planner.kicker')}</span><strong>{t('planner.title')}</strong></span>
          <span className="planner-summary" title={routeSummary}>{(planner.startId || planner.destinationId) ? routeSummary : ''}</span>
          <button type="button" className="planner-toggle" aria-label={t(plannerOpen ? 'planner.actions.hideLabel' : 'planner.actions.edit')} aria-expanded={plannerOpen} aria-controls="planner-body" onClick={() => setPanelOpen('planner', !plannerOpen)}>{t(plannerOpen ? 'planner.actions.hide' : 'planner.actions.edit')}</button>
        </header>
        {plannerOpen && <div className="planner-body" id="planner-body">
          <div className="place-row">
            <PlaceSearchInput kind="start" searchIndex={placeSearchIndex} translations={planner.translations} value={planner.startId} onChange={planner.setStartId} />
            <button type="button" className="swap-places" onClick={planner.swapPlaces} aria-label={t('planner.actions.swap')} title={t('planner.actions.swap')}>⇄</button>
            <PlaceSearchInput kind="destination" searchIndex={placeSearchIndex} translations={planner.translations} value={planner.destinationId} onChange={planner.setDestinationId} />
          </div>
          <div className="planner-actions">
            <label className="profile-control"><span>{t('planner.routeField')}</span><select aria-label={t('profile.label')} value={planner.profile} onChange={(event) => planner.setProfile(event.target.value as PlannerViewModel['profile'])}><option value="shortest">{t('profile.shortest')}</option><option value="accessible">{t('profile.accessible')}</option><option value="avoid-stairs">{t('profile.avoidStairs')}</option><option value="prefer-elevator">{t('profile.preferElevator')}</option><option value="fewest-floor-changes">{t('profile.fewestFloorChanges')}</option></select></label>
            <button type="button" className="submit-route" onClick={planner.submitRoute} disabled={!planner.startId || !planner.destinationId || !planner.routeDirty}>{t(planner.route.status === 'ok' ? 'planner.actions.update' : 'planner.actions.show')}</button>
            <button type="button" className="clear-route" onClick={planner.clearRoute} disabled={!planner.startId && !planner.destinationId && planner.route.status !== 'ok'}>{t('planner.actions.clear')}</button>
            <button type="button" className="share-route" onClick={() => void copyRouteLink()} disabled={planner.route.status !== 'ok' || planner.routeDirty}>{t('planner.actions.share')}</button>
          </div>
          <p className={`planner-status ${planner.route.status === 'ok' || emptyRequest ? '' : 'planner-status-error'}`} role={planner.route.status === 'ok' || emptyRequest ? 'status' : 'alert'}>{routeMessage(planner.route, locale)}</p>
        </div>}
      </section> : <RouteSheet route={planner.route} translations={planner.translations} selectedStepIndex={camera.selectedStepIndex} onStepSelect={camera.selectStep} expanded={panelOpen('directions')} onExpandedChange={(open) => setPanelOpen('directions', open)} onEditRoute={() => setPanelOpen('planner', true)} />}
    </div>
    {(shareMessage || feedback.interactionMessage) && <div className="app-toast" role="status">{shareMessage || feedback.interactionMessage}</div>}
  </div>;
}
