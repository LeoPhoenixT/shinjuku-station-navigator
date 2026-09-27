import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildPlaceSearchIndex } from '../features/route-planner/placeSearch.js';
import { publicPlaceName } from '../places/placePresentation.js';
import type { RoutePlan } from '../routing/routeService.js';
import { estimateJourney, estimatedTimeText } from '../routing/journeyEstimate.js';
import { MapToolbar } from './MapToolbar.js';
import { PlaceSearchInput } from './PlaceSearchInput.js';
import { MapLegend } from './MapLegend.js';
import { RouteSheet } from './RouteSheet.js';
import { useI18n } from '../i18n/context.js';
import { translate, type Locale } from '../i18n/types.js';
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
    if (planner.displayedRoute.status !== 'ok' && !narrow) panels.add('planner');
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
    if (planner.displayedRoute.status === 'ok') setPanelOpen('planner', false);
  }, [planner.displayedRoute, setPanelOpen]);
  const copyRouteLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareMessage(t('route.shareCopied'));
    } catch {
      setShareMessage(t('route.shareUnavailable'));
    }
  };
  const routeSummary = planner.displayedRoute.status === 'ok'
    ? t('route.summary', {
      start: publicPlaceName(planner.displayedRoute.start, locale, planner.translations),
      destination: publicPlaceName(planner.displayedRoute.destination, locale, planner.translations),
      time: estimatedTimeText(estimateJourney(planner.displayedRoute), locale),
      distance: planner.displayedRoute.totalDistanceMeters.toFixed(1),
    })
    : planner.draft.startId || planner.draft.destinationId ? t('planner.summary.complete') : t('planner.title');
  const emptyRequest = planner.displayedRoute.status === 'invalid-place' && planner.displayedRoute.placeId.length === 0;

  return <div className="route-controls">
    <MapToolbar
      navigation={navigation} display={display} canFitRoute={planner.displayedRoute.status === 'ok'}
      settingsOpen={panelOpen('settings')} onSettingsOpenChange={(open) => setPanelOpen('settings', open)}
    />
    <div className="journey-stack">
      <MapLegend items={legend.items} open={panelOpen('legend')} onOpenChange={(open) => setPanelOpen('legend', open)} />
      {(plannerOpen || planner.displayedRoute.status !== 'ok') ? <section className={`planner-card ${plannerOpen ? '' : 'planner-card-collapsed'} ${emptyRequest && !plannerOpen ? 'planner-card-empty' : ''}`} aria-label={t('planner.label')}>
        <header className="planner-header">
          <span><span className="planner-kicker">{t('planner.kicker')}</span><strong>{t('planner.title')}</strong></span>
          <span className="planner-summary" title={routeSummary}>{(planner.draft.startId || planner.draft.destinationId) ? routeSummary : ''}</span>
          <button type="button" className="planner-toggle" aria-label={t(plannerOpen ? 'planner.actions.hideLabel' : 'planner.actions.edit')} aria-expanded={plannerOpen} aria-controls="planner-body" onClick={() => setPanelOpen('planner', !plannerOpen)}>{t(plannerOpen ? 'planner.actions.hide' : 'planner.actions.edit')}</button>
        </header>
        {plannerOpen && <div className="planner-body" id="planner-body">
          <div className="place-row">
            <PlaceSearchInput kind="start" searchIndex={placeSearchIndex} translations={planner.translations} value={planner.draft.startId} onChange={planner.draft.setStartId} />
            <button type="button" className="swap-places" onClick={planner.swapPlaces} aria-label={t('planner.actions.swap')} title={t('planner.actions.swap')}>⇄</button>
            <PlaceSearchInput kind="destination" searchIndex={placeSearchIndex} translations={planner.translations} value={planner.draft.destinationId} onChange={planner.draft.setDestinationId} />
          </div>
          <div className="planner-actions">
            <label className="profile-control"><span>{t('planner.routeField')}</span><select aria-label={t('profile.label')} value={planner.draft.profile} onChange={(event) => planner.draft.setProfile(event.target.value as PlannerViewModel['draft']['profile'])}><option value="shortest">{t('profile.shortest')}</option><option value="accessible">{t('profile.accessible')}</option><option value="avoid-stairs">{t('profile.avoidStairs')}</option><option value="prefer-elevator">{t('profile.preferElevator')}</option><option value="fewest-floor-changes">{t('profile.fewestFloorChanges')}</option></select></label>
            <button type="button" className="submit-route" onClick={planner.submitRoute} disabled={!planner.draft.startId || !planner.draft.destinationId || !planner.draft.dirty}>{t(planner.displayedRoute.status === 'ok' ? 'planner.actions.update' : 'planner.actions.show')}</button>
            <button type="button" className="clear-route" onClick={planner.clearRoute} disabled={!planner.draft.startId && !planner.draft.destinationId && planner.displayedRoute.status !== 'ok'}>{t('planner.actions.clear')}</button>
            <button type="button" className="share-route" onClick={() => void copyRouteLink()} disabled={planner.displayedRoute.status !== 'ok' || planner.draft.dirty}>{t('planner.actions.share')}</button>
          </div>
          <p className={`planner-status ${planner.displayedRoute.status === 'ok' || emptyRequest ? '' : 'planner-status-error'}`} role={planner.displayedRoute.status === 'ok' || emptyRequest ? 'status' : 'alert'}>{routeMessage(planner.displayedRoute, locale)}</p>
        </div>}
      </section> : <RouteSheet route={planner.displayedRoute} translations={planner.translations} selectedStepIndex={camera.selectedStepIndex} onStepSelect={camera.selectStep} expanded={panelOpen('directions')} onExpandedChange={(open) => setPanelOpen('directions', open)} onEditRoute={() => setPanelOpen('planner', true)} />}
    </div>
    {(shareMessage || feedback.interactionMessage) && <div className="app-toast" role="status">{shareMessage || feedback.interactionMessage}</div>}
  </div>;
}
