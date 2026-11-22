import { useEffect, useState } from 'react';
import { loadSurfaceContext } from '../data/loadMapData.js';
import type { SurfaceContext } from '../schema/surfaceContext.js';

export function useSurfaceContext(enabled: boolean): SurfaceContext | undefined {
  const [data, setData] = useState<SurfaceContext>();
  useEffect(() => {
    if (!enabled || data) return;
    const controller = new AbortController();
    void loadSurfaceContext(controller.signal).then((surface) => {
      if (!controller.signal.aborted) setData(surface);
    }).catch(() => {
      // Indoor navigation remains available. Toggling the layer on retries the request.
    });
    return () => controller.abort();
  }, [data, enabled]);
  return enabled ? data : undefined;
}
