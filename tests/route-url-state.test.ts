import { describe, expect, it } from 'vitest';
import { readRouteUrl, writeRouteUrl } from '../src/features/route-planner/routeUrlState';

describe('Phase 8 route URL state', () => {
  it('round-trips a supported routing profile', () => {
    const search = writeRouteUrl({ startId: 'a', destinationId: 'b', profile: 'prefer-elevator' });
    expect(readRouteUrl(search, ['x', 'y'])).toEqual({ startId: 'a', destinationId: 'b', profile: 'prefer-elevator' });
  });

  it('falls back safely when a shared URL contains an unknown profile', () => {
    expect(readRouteUrl('?start=a&destination=b&profile=future', ['x', 'y']).profile).toBe('shortest');
  });

  it('preserves an explicitly cleared route without restoring defaults', () => {
    const search = writeRouteUrl({ startId: '', destinationId: '', profile: 'shortest' });
    expect(readRouteUrl(search, ['x', 'y'])).toEqual({ startId: '', destinationId: '', profile: 'shortest' });
  });
});
