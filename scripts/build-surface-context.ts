import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { lonLatToLocalMeters } from '../src/data/coordinates.js';
import { parseSurfaceContext, SURFACE_BOUNDS, SURFACE_CONTEXT_FILE, type LandmarkId, type SurfacePath, type SurfacePoint } from '../src/schema/surfaceContext.js';
import { clipLinePath } from './data/clip-line-path.js';
import { isMainModule } from './data/is-main-module.js';

export const SURFACE_ROAD_INPUT = 'data/shinjuku-surface-roads.source.json';
export const SURFACE_CONTEXT_OUTPUT = `public/data/processed/${SURFACE_CONTEXT_FILE}` as const;

// Approximate area anchors read against the Shinjuku City plan, the GSI map,
// and the nearby MLIT station openings. These are orientation labels.
const LANDMARK_LOCATIONS: Record<LandmarkId, SurfacePoint> = {
  'east-exit': [139.70132, 35.69142],
  'west-exit': [139.69906, 35.69055],
  busta: [139.70083, 35.68852],
};

function localPoint([lon, lat]: SurfacePoint): SurfacePoint {
  const { x, z } = lonLatToLocalMeters({ lon, lat });
  return [x, z];
}

function localRoadPaths(value: unknown): SurfacePath[] {
  if (!Array.isArray(value)) throw new Error('Invalid GSI surface road paths.');
  return value.flatMap((line: unknown) => {
    if (!Array.isArray(line) || line.length < 2 || !line.every((point: unknown) =>
      Array.isArray(point) && point.length === 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]))) {
      throw new Error('Invalid GSI surface road path.');
    }
    return clipLinePath(line.map(localPoint), {
      left: SURFACE_BOUNDS.minX, right: SURFACE_BOUNDS.maxX, top: SURFACE_BOUNDS.minZ, bottom: SURFACE_BOUNDS.maxZ,
    }, ([x, z]) => [Math.round(x * 100) / 100, Math.round(z * 100) / 100]);
  });
}

export function buildSurfaceContext(output: string = SURFACE_CONTEXT_OUTPUT): void {
  const source = JSON.parse(readFileSync(SURFACE_ROAD_INPUT, 'utf8')) as Record<string, unknown>;
  const data = parseSurfaceContext({
    schemaVersion: 1,
    roadEdges: localRoadPaths(source.roadEdges),
    roadMedians: localRoadPaths(source.roadMedians),
    landmarks: Object.entries(LANDMARK_LOCATIONS).map(([id, point]) => ({ id, position: localPoint(point) })),
  });
  mkdirSync(path.dirname(output), { recursive: true });
  const encodePaths = (paths: SurfacePath[]) => paths.map((line) => `    ${JSON.stringify(line)}`).join(',\n');
  writeFileSync(output, `{\n  "schemaVersion": 1,\n  "roadEdges": [\n${encodePaths(data.roadEdges)}\n  ],\n  "roadMedians": [\n${encodePaths(data.roadMedians)}\n  ],\n  "landmarks": ${JSON.stringify(data.landmarks)}\n}\n`);
}

if (isMainModule(import.meta.url)) buildSurfaceContext();
