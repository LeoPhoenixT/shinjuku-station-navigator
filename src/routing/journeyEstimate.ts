import type { RoutePlan } from './routeService.js';
import { translate, type Locale } from '../i18n/types.js';

export const WALKING_SPEED_METERS_PER_SECOND = 1.2;

export const TRANSITION_ALLOWANCE_SECONDS = {
  stairs: 15,
  escalator: 20,
  elevator: 45,
} as const;

export interface JourneyEstimate {
  durationSeconds: number;
  displayMinutes: number;
  floorChanges: number;
}

export function estimateJourney(route: Extract<RoutePlan, { status: 'ok' }>): JourneyEstimate {
  const transitions = route.steps.filter((step) => step.kind === 'transition');
  const transitionAllowance = transitions.reduce((total, step) => {
    if (step.movement === 'stairs' || step.movement === 'escalator' || step.movement === 'elevator') {
      return total + TRANSITION_ALLOWANCE_SECONDS[step.movement];
    }
    return total;
  }, 0);
  const durationSeconds = Math.ceil(route.totalDistanceMeters / WALKING_SPEED_METERS_PER_SECOND + transitionAllowance);
  return {
    durationSeconds,
    displayMinutes: durationSeconds === 0 ? 0 : Math.max(1, Math.ceil(durationSeconds / 60)),
    floorChanges: transitions.length,
  };
}

export function estimatedTimeText(estimate: JourneyEstimate, locale: Locale = 'en'): string {
  if (estimate.displayMinutes === 0) return translate(locale, 'time.alreadyThere');
  return translate(locale, 'time.aboutMinutes', { minutes: estimate.displayMinutes });
}
