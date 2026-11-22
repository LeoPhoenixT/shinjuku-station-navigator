import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { PMTiles, TileType } from 'pmtiles';
import { SURFACE_ROAD_INPUT } from './build-surface-context.js';
import { clipLinePath } from './data/clip-line-path.js';
import { isMainModule } from './data/is-main-module.js';

const ARCHIVE_URL = 'https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/optimal_bvmap-v1.pmtiles';
const GSI_EDITION = '2026-07-01';
const ARCHIVE_ETAG = '"dfa81a9cba11aad28247d63a2d8361ec-2015"';
const ZOOM = 16;
const WEST = 58198;
const EAST = 58200;
const NORTH = 25803;
const SOUTH = 25805;
const ROAD_EDGE_CODES = new Set([2201, 2203, 2221, 2223, 2241, 2243, 2251, 2271, 2273]);

type LonLat = [longitude: number, latitude: number];

function tileRoads(tile: VectorTile, x: number, y: number, layerName: 'RdEdg' | 'RdCompt'): LonLat[][] {
  const layer = tile.layers[layerName];
  if (!layer) return [];
  const paths: LonLat[][] = [];
  const toLonLat = ([px, py]: [number, number]): LonLat => {
    const n = 2 ** ZOOM;
    const lon = (x + px / layer.extent) / n * 360 - 180;
    const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + py / layer.extent) / n))) * 180 / Math.PI;
    return [Number(lon.toFixed(7)), Number(lat.toFixed(7))];
  };
  const bounds = { left: 0, right: layer.extent, top: 0, bottom: layer.extent };
  for (let index = 0; index < layer.length; index += 1) {
    const feature = layer.feature(index);
    const code = feature.properties.vt_code;
    if (feature.type !== 2 || typeof code !== 'number') continue;
    // Keep road edges, including bridges such as Koshu Kaido, and visible medians.
    if (layerName === 'RdEdg' ? !ROAD_EDGE_CODES.has(code) : code !== 2411) continue;
    for (const line of feature.loadGeometry()) {
      paths.push(...clipLinePath(line.map(({ x: px, y: py }) => [px, py]), bounds, toLonLat));
    }
  }
  return paths;
}

async function refreshSurfaceRoads(destination: string): Promise<void> {
  const archive = new PMTiles(ARCHIVE_URL);
  const header = await archive.getHeader();
  if (header.tileType !== TileType.Mvt || header.etag !== ARCHIVE_ETAG) {
    throw new Error(`Unexpected GSI archive ETag or type. Review the upstream edition before refreshing (${header.etag}).`);
  }
  const tiles: Array<{ x: number; y: number; sha256: string }> = [];
  const roadEdges: LonLat[][] = [];
  const roadMedians: LonLat[][] = [];
  for (let x = WEST; x <= EAST; x += 1) {
    for (let y = NORTH; y <= SOUTH; y += 1) {
      const result = await archive.getZxy(ZOOM, x, y, AbortSignal.timeout(30_000));
      if (!result) throw new Error(`GSI archive is missing tile ${ZOOM}/${x}/${y}.`);
      const tile = new VectorTile(new PbfReader(new Uint8Array(result.data)));
      tiles.push({ x, y, sha256: createHash('sha256').update(new Uint8Array(result.data)).digest('hex') });
      roadEdges.push(...tileRoads(tile, x, y, 'RdEdg'));
      roadMedians.push(...tileRoads(tile, x, y, 'RdCompt'));
    }
  }
  if ((await archive.getHeader()).etag !== ARCHIVE_ETAG) throw new Error('The GSI archive changed during acquisition.');
  if (!roadEdges.length || !roadMedians.length) throw new Error('The GSI snapshot is missing roads or medians.');
  const provenance = { url: ARCHIVE_URL, edition: GSI_EDITION, archiveEtag: ARCHIVE_ETAG, zoom: ZOOM, tiles };
  const encodePaths = (paths: LonLat[][]) => paths.map((line) => `    ${JSON.stringify(line)}`).join(',\n');
  writeFileSync(destination, `{\n  "provenance": ${JSON.stringify(provenance)},\n  "roadEdges": [\n${encodePaths(roadEdges)}\n  ],\n  "roadMedians": [\n${encodePaths(roadMedians)}\n  ]\n}\n`);
  console.log(`Extracted ${roadEdges.length} road edge paths and ${roadMedians.length} median paths from ${tiles.length} GSI tiles.`);
}

if (isMainModule(import.meta.url)) await refreshSurfaceRoads(process.argv[2] ?? SURFACE_ROAD_INPUT);
