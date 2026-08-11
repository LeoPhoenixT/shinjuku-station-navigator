import { useEffect, useState } from 'react';
import { loadMapData, type MapDatasets } from '../data/loadMapData.js';

export type MapDataState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: MapDatasets };

export function useMapData(): MapDataState {
  const [state, setState] = useState<MapDataState>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    loadMapData(controller.signal).then((data) => setState({ status: 'ready', data })).catch((reason: unknown) => {
      if (!controller.signal.aborted) setState({ status: 'error', message: reason instanceof Error ? reason.message : '' });
    });
    return () => controller.abort();
  }, []);
  return state;
}
