import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadMapData, processedDataUrl } from '../src/data/loadMapData';

const values = [
  JSON.parse(readFileSync('public/data/processed/shinjuku-full-map.json', 'utf8')),
  JSON.parse(readFileSync('public/data/processed/jr-shinjuku-ticket-gates-b1-official-network.json', 'utf8')),
  JSON.parse(readFileSync('public/data/processed/shinjuku-reviewed-custom-network.json', 'utf8')),
  JSON.parse(readFileSync('public/data/processed/shinjuku-b1-named-places.json', 'utf8')),
  JSON.parse(readFileSync('public/data/processed/shinjuku-place-translations.json', 'utf8')),
];

afterEach(() => vi.unstubAllGlobals());

describe('map data loader', () => {
  it('loads and validates the five runtime datasets', async () => {
    let index = 0;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(values[index++]), { status: 200 })));
    const result = await loadMapData();
    expect(result.floor.features.length).toBeGreaterThan(0);
    expect(result.floor.features.length).toBe(4387);
    expect(result.floor.layers?.Facility.featureCount).toBe(639);
    expect(result.network.nodes.length).toBe(1982);
    expect(result.reviewedNetwork.nodes.length).toBe(6);
    expect(result.places.places.length).toBe(result.places.statistics.placeCount);
    expect(result.places.places.length).toBeGreaterThan(67);
    expect(result.translations.places.length).toBe(result.places.statistics.routablePlaceCount);
  });

  it.each(['/', '/ja/', '/ja/index.html'])('loads shared data from the site root at %s', async (pathname) => {
    window.history.replaceState(null, '', pathname);
    let index = 0;
    const requestedUrls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      requestedUrls.push(url);
      return new Response(JSON.stringify(values[index++]), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    await loadMapData();
    expect(fetchMock).toHaveBeenCalledTimes(5);
    for (const url of requestedUrls) {
      expect(new URL(url).pathname.startsWith('/data/processed/')).toBe(true);
    }
  });

  it('resolves relative production assets under a deployment prefix', () => {
    expect(processedDataUrl('shinjuku-full-map.json', 'https://example.test/prefix/ja/', './'))
      .toBe('https://example.test/prefix/data/processed/shinjuku-full-map.json');
    expect(processedDataUrl('shinjuku-full-map.json', 'https://example.test/prefix/', './'))
      .toBe('https://example.test/prefix/data/processed/shinjuku-full-map.json');
  });

  it('surfaces HTTP and schema failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(loadMapData()).rejects.toThrow('HTTP 503');

    let index = 0;
    const invalid = structuredClone(values);
    invalid[1].schemaVersion = 99;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(invalid[index++]), { status: 200 })));
    await expect(loadMapData()).rejects.toThrow('Unsupported official-network schemaVersion 99');
  });
});
