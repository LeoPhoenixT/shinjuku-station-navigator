import { ROUTING_PROFILES, type RoutingProfile } from '../../routing/pathfinding.js';

export const ROUTE_PROFILE: RoutingProfile = 'shortest';

export interface RouteUrlRequest {
  startId: string;
  destinationId: string;
  profile: RoutingProfile;
}

export function readRouteUrl(search: string, defaults: [string, string]): RouteUrlRequest {
  const params = new URLSearchParams(search);
  return {
    startId: params.has('start') ? params.get('start') ?? '' : defaults[0],
    destinationId: params.has('destination') ? params.get('destination') ?? '' : defaults[1],
    profile: ROUTING_PROFILES.includes(params.get('profile') as RoutingProfile) ? params.get('profile') as RoutingProfile : ROUTE_PROFILE,
  };
}

export function writeRouteUrl(request: RouteUrlRequest): string {
  const params = new URLSearchParams();
  params.set('start', request.startId);
  params.set('destination', request.destinationId);
  params.set('profile', request.profile);
  return `?${params.toString()}`;
}
