import { parseFloorDataset, parseNamedPlaces, parseOfficialNetwork, type NamedPlacesDataset, type OfficialNetworkDataset } from '../schema/processed.js';
import { parseReviewedCustomNetwork, type ReviewedCustomNetworkDataset } from '../schema/reviewedCustomNetwork.js';
import type { ProcessedDataset } from '../types/processed.js';
import { parsePlaceTranslations, type PlaceTranslationsDataset } from '../schema/placeTranslations.js';

export interface MapDatasets { floor: ProcessedDataset; network: OfficialNetworkDataset; reviewedNetwork: ReviewedCustomNetworkDataset; places: NamedPlacesDataset; translations: PlaceTranslationsDataset }

const urls = {
  floor: `${import.meta.env.BASE_URL}data/processed/shinjuku-full-map.json`,
  network: `${import.meta.env.BASE_URL}data/processed/jr-shinjuku-ticket-gates-b1-official-network.json`,
  reviewedNetwork: `${import.meta.env.BASE_URL}data/processed/shinjuku-reviewed-custom-network.json`,
  places: `${import.meta.env.BASE_URL}data/processed/shinjuku-b1-named-places.json`,
  translations: `${import.meta.env.BASE_URL}data/processed/shinjuku-place-translations.json`,
};

async function json(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function loadMapData(signal?: AbortSignal): Promise<MapDatasets> {
  const [floorValue, networkValue, reviewedNetworkValue, placesValue, translationsValue] = await Promise.all([json(urls.floor, signal), json(urls.network, signal), json(urls.reviewedNetwork, signal), json(urls.places, signal), json(urls.translations, signal)]);
  const floor = parseFloorDataset(floorValue);
  const network = parseOfficialNetwork(networkValue);
  const reviewedNetwork = parseReviewedCustomNetwork(reviewedNetworkValue, network);
  const places = parseNamedPlaces(placesValue, network, reviewedNetwork);
  const translations = parsePlaceTranslations(translationsValue, places);
  return { floor, network, reviewedNetwork, places, translations };
}
