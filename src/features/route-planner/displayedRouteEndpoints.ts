import type { RoutePlan } from '../../routing/routeService.js';

export function displayedRouteEndpoints(route: RoutePlan, startId: string, destinationId: string): { startId: string; destinationId: string } {
  if (route.status === 'ok') return { startId: route.start.id, destinationId: route.destination.id };
  return { startId, destinationId };
}
