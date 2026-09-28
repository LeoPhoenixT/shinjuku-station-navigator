import { parseFloorDataset, parseNamedPlaces, parseOfficialNetwork, type NamedPlacesDataset, type OfficialNetworkDataset } from '../schema/processed.js';
import { parseReviewedCustomNetwork, type ReviewedCustomNetworkDataset } from '../schema/reviewedCustomNetwork.js';
import type { ProcessedDataset } from '../types/processed.js';
import { parsePlaceTranslations, type PlaceTranslationsDataset } from '../schema/placeTranslations.js';

export interface MapDatasets { floor: ProcessedDataset; network: OfficialNetworkDataset; reviewedNetwork: ReviewedCustomNetworkDataset; places: NamedPlacesDataset; translations: PlaceTranslationsDataset }

export function processedDataUrl(fileName: string, pageUrl = window.location.href, viteBaseUrl = import.meta.env.BASE_URL): string {
  // The Japanese entry page lives one directory below the shared data assets.
  const page = new URL(pageUrl);
  const pageRoot = new URL(/\/ja\/(?:index\.html)?$/.test(page.pathname) ? '../' : './', page);
  const baseUrl = new URL(viteBaseUrl, viteBaseUrl.startsWith('/') ? page.origin : pageRoot);
  return new URL(`data/processed/${fileName}`, baseUrl).href;
}

async function json(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function loadMapData(signal?: AbortSignal): Promise<MapDatasets> {
  const [floorValue, networkValue, reviewedNetworkValue, placesValue, translationsValue] = await Promise.all([
    json(processedDataUrl('shinjuku-full-map.json'), signal),
    json(processedDataUrl('jr-shinjuku-ticket-gates-b1-official-network.json'), signal),
    json(processedDataUrl('shinjuku-reviewed-custom-network.json'), signal),
    json(processedDataUrl('shinjuku-b1-named-places.json'), signal),
    json(processedDataUrl('shinjuku-place-translations.json'), signal),
  ]);
  const floor = parseFloorDataset(floorValue);
  const network = parseOfficialNetwork(networkValue);
  const reviewedNetwork = parseReviewedCustomNetwork(reviewedNetworkValue, network);
  const places = parseNamedPlaces(placesValue, network, reviewedNetwork);
  const translations = parsePlaceTranslations(translationsValue, places);
  return { floor, network, reviewedNetwork, places, translations };
}
