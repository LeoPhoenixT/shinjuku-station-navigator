import type { RoutePlan } from '../../routing/routeService.js';

export function displayedRouteEndpoints(displayedRoute: RoutePlan, draft: { readonly startId: string; readonly destinationId: string }): { startId: string; destinationId: string } {
  if (displayedRoute.status === 'ok') return { startId: displayedRoute.start.id, destinationId: displayedRoute.destination.id };
  return { startId: draft.startId, destinationId: draft.destinationId };
}
