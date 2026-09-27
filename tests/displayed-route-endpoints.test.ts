import { describe, expect, it } from 'vitest';
import { displayedRouteEndpoints } from '../src/features/route-planner/displayedRouteEndpoints';
import type { RoutePlan } from '../src/routing/routeService';

describe('displayed route endpoints', () => {
  const route = { status: 'ok', start: { id: 'A' }, destination: { id: 'B' } } as RoutePlan;

  it('keeps visible route markers on submitted endpoints while the draft changes', () => {
    expect(displayedRouteEndpoints(route, 'C', 'B')).toEqual({ startId: 'A', destinationId: 'B' });
  });

  it('shows draft markers when there is no displayed route', () => {
    expect(displayedRouteEndpoints({ status: 'invalid-place', placeId: '', reason: 'not-found' }, 'C', '')).toEqual({ startId: 'C', destinationId: '' });
  });
});
