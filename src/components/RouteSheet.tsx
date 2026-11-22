import { useState } from 'react';
import type { RoutePlan } from '../routing/routeService.js';
import type { RouteStep } from '../routing/routeInstructions.js';
import { floorDisplayName, publicPlaceName } from '../places/placePresentation.js';
import { estimateJourney, estimatedTimeText } from '../routing/journeyEstimate.js';
import { useI18n } from '../i18n/context.js';
import { formatFloorChanges, formatMovement, formatRouteInstruction, formatRouteWarning, formatRoutingProfile, formatWarningCount } from '../i18n/formatters.js';
import type { Locale } from '../i18n/types.js';
import type { PlaceTranslationsDataset } from '../schema/placeTranslations.js';

interface RouteSheetProps {
  route: RoutePlan;
  translations?: PlaceTranslationsDataset;
  selectedStepIndex?: number;
  onStepSelect: (index: number) => void;
  onFitStep: (index: number) => void;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onEditRoute?: () => void;
}

function stepIcon(step: RouteStep): string {
  if (step.kind === 'turn-left') return '↰';
  if (step.kind === 'turn-right') return '↱';
  if (step.kind === 'transition') return step.movement === 'elevator' ? '⇅' : step.movement === 'escalator' ? '↗' : '↕';
  if (step.kind === 'arrive') return '●';
  if (step.kind === 'access') return '◇';
  return '↑';
}

function floorBadge(step: RouteStep, locale: Locale): string {
  const from = floorDisplayName(step.floorFrom, locale);
  const to = floorDisplayName(step.floorTo, locale);
  return from === to ? from : `${from} → ${to}`;
}

export function RouteSheet({ route, translations, selectedStepIndex, onStepSelect, onFitStep, expanded: controlledExpanded, onExpandedChange, onEditRoute }: RouteSheetProps) {
  const { locale, t } = useI18n();
  const [localExpanded, setLocalExpanded] = useState(false);
  const expanded = controlledExpanded ?? localExpanded;
  const setExpanded = (next: boolean) => controlledExpanded === undefined ? setLocalExpanded(next) : onExpandedChange?.(next);
  if (route.status !== 'ok') return null;
  const estimate = estimateJourney(route);
  const activeIndex = Math.min(selectedStepIndex ?? 0, Math.max(0, route.steps.length - 1));
  const activeStep = route.steps[activeIndex];
  const startName = publicPlaceName(route.start, locale, translations);
  const destinationName = publicPlaceName(route.destination, locale, translations);
  const journeyLabel = t('route.journey', { start: startName, destination: destinationName });
  const movementTypes = [...new Set(route.steps.map((step) => step.movement).filter((movement): movement is NonNullable<typeof movement> => Boolean(movement)))];
  const accessibilitySensitive = route.profile === 'accessible' || route.profile === 'avoid-stairs' || route.profile === 'prefer-elevator';
  const warningMessages = route.warnings.map((warning) => formatRouteWarning(warning, [route.start, route.destination], locale, translations));
  const instruction = (step: RouteStep) => formatRouteInstruction(step, route.start, route.destination, locale, translations);
  return <section className={`route-sheet ${expanded ? 'route-sheet-expanded' : ''}`} aria-labelledby="route-summary-heading">
    <header className="route-sheet-header">
      <h2 id="route-summary-heading" className="route-sheet-journey">
        <span className="visually-hidden">{journeyLabel}</span>
        <span className="route-sheet-endpoint" aria-hidden="true"><b>A</b>{startName}</span>
        <span className="route-sheet-endpoint" aria-hidden="true"><b>B</b>{destinationName}</span>
      </h2>
      <p className="route-sheet-meta">
        <span>{estimatedTimeText(estimate, locale)}</span>
        <span>{route.totalDistanceMeters.toFixed(1)} m</span>
        <span>{formatFloorChanges(estimate.floorChanges, locale)}</span>
        <span>{formatRoutingProfile(route.profile, locale)}</span>
      </p>
      <div className="route-sheet-actions">
        <button type="button" className="route-sheet-toggle" aria-expanded={expanded} aria-controls={expanded ? 'route-step-list' : undefined} onClick={() => setExpanded(!expanded)}>
          {t(expanded ? 'routeSheet.hideDirections' : 'routeSheet.showDirections')} <span aria-hidden="true">{expanded ? '⌄' : '⌃'}</span>
        </button>
        {onEditRoute && <button type="button" className="route-sheet-edit" onClick={onEditRoute}>{t('routeSheet.edit')}</button>}
      </div>
    </header>
    <p className="visually-hidden">{t('routeSheet.screenReader', { steps: route.steps.length, movements: movementTypes.length > 0 ? movementTypes.map((movement) => formatMovement(movement, locale)).join(locale === 'ja' ? '、' : ', ') : t('routeSheet.movementWalking'), warnings: formatWarningCount(route.warnings.length, locale) })}</p>
    {warningMessages.length > 0 && <div className="route-warning-list">{warningMessages.map((warning, index) => <p className="route-warning" role="alert" key={`${route.warnings[index].code}:${warning}`}>{warning}</p>)}</div>}
    {accessibilitySensitive && <p className="route-data-notice">{t('routeSheet.dataNotice')}</p>}
    {activeStep && <div className="current-step">
      <div className="current-step-actions">
        <button type="button" onClick={() => onStepSelect(activeIndex - 1)} disabled={activeIndex === 0} aria-label={t('routeSheet.previousLabel')}>{t('routeSheet.previous')}</button>
        <button type="button" onClick={() => onStepSelect(activeIndex + 1)} disabled={activeIndex >= route.steps.length - 1} aria-label={t('routeSheet.nextLabel')}>{t('routeSheet.next')}</button>
        <button type="button" onClick={() => onFitStep(activeIndex)}>{t('routeSheet.fitStep')}</button>
      </div>
      <span className={`step-icon step-${activeStep.kind}`} aria-hidden="true">{stepIcon(activeStep)}</span>
      <div className="current-step-copy" aria-live="polite" aria-atomic="true">
        <span>{t('routeSheet.step', { current: activeIndex + 1, total: route.steps.length, floor: floorBadge(activeStep, locale) })}</span>
        <strong>{instruction(activeStep)}</strong>
      </div>
    </div>}
    {expanded && <div className="route-sheet-body" id="route-step-list">
      <ol className="route-step-list">
        {route.steps.map((step, index) => <li key={`${step.kind}:${index}`}>
          <button type="button" className={`route-step ${selectedStepIndex === index ? 'route-step-selected' : ''}`} aria-pressed={selectedStepIndex === index} onClick={() => onStepSelect(index)}>
            <span className={`step-icon step-${step.kind}`} aria-hidden="true">{stepIcon(step)}</span>
            <span className="step-copy"><span className="floor-badge">{floorBadge(step, locale)}</span><span>{instruction(step)}</span></span>
          </button>
        </li>)}
      </ol>
    </div>}
  </section>;
}
