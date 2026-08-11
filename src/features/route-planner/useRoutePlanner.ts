import { useEffect, useMemo, useState } from 'react';
import type { NamedPlaceRecord, OfficialNetworkDataset } from '../../schema/processed.js';
import type { RoutingGraph } from '../../graph/types.js';
import { planRoute, type RoutePlan } from '../../routing/routeService.js';
import { readRouteUrl, writeRouteUrl } from './routeUrlState.js';
import type { RoutingProfile } from '../../routing/pathfinding.js';

export interface RoutePlannerState {
  startId: string;
  destinationId: string;
  setStartId: (id: string) => void;
  setDestinationId: (id: string) => void;
  route: RoutePlan;
  profile: RoutingProfile;
  setProfile: (profile: RoutingProfile) => void;
  routeDirty: boolean;
  submitRoute: () => void;
  clearRoute: () => void;
  routeToDestination: (destinationId: string) => void;
}

export function useRoutePlanner(network: OfficialNetworkDataset, graph: RoutingGraph, places: NamedPlaceRecord[]): RoutePlannerState {
  const initial = useMemo<[string, string]>(() => ['', ''], []);
  const request = useMemo(() => readRouteUrl(window.location.search, initial), [initial]);
  const [startId, setStartId] = useState(request.startId);
  const [destinationId, setDestinationId] = useState(request.destinationId);
  const [profile, setProfile] = useState<RoutingProfile>(request.profile);
  const [submitted, setSubmitted] = useState(request);
  const routeDirty = startId !== submitted.startId || destinationId !== submitted.destinationId || profile !== submitted.profile;
  const route = useMemo(() => planRoute(network, graph, places, submitted.startId, submitted.destinationId, submitted.profile), [network, graph, places, submitted]);

  useEffect(() => {
    const search = writeRouteUrl(submitted);
    window.history.replaceState(null, '', `${window.location.pathname}${search}${window.location.hash}`);
  }, [submitted]);

  useEffect(() => {
    const restore = () => {
      const restored = readRouteUrl(window.location.search, initial);
      setStartId(restored.startId);
      setDestinationId(restored.destinationId);
      setProfile(restored.profile);
      setSubmitted(restored);
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [initial]);

  const submitRoute = () => setSubmitted({ startId, destinationId, profile });
  const clearRoute = () => {
    const cleared = { startId: '', destinationId: '', profile };
    setStartId('');
    setDestinationId('');
    setSubmitted(cleared);
  };
  const routeToDestination = (nextDestinationId: string) => {
    const next = { startId, destinationId: nextDestinationId, profile };
    setDestinationId(nextDestinationId);
    setSubmitted(next);
  };

  return { startId, destinationId, setStartId, setDestinationId, route, profile, setProfile, routeDirty, submitRoute, clearRoute, routeToDestination };
}
