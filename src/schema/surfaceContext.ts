export const SURFACE_CONTEXT_FILE = 'shinjuku-surface-context.json';
export const SURFACE_CONTEXT_SOURCE = 'https://github.com/gsi-cyberjapan/optimal_bvmap';
export const SURFACE_BOUNDS = { minX: -520, maxX: 435, minZ: -640, maxZ: 540 };

export type SurfacePoint = [x: number, z: number];
export type SurfacePath = SurfacePoint[];
export const LANDMARK_IDS = ['east-exit', 'west-exit', 'busta'] as const;
export type LandmarkId = typeof LANDMARK_IDS[number];

export interface SurfaceContext {
  schemaVersion: 1;
  roadEdges: SurfacePath[];
  roadMedians: SurfacePath[];
  landmarks: Array<{ id: LandmarkId; position: SurfacePoint }>;
}

function pointInCoverage(value: unknown): value is SurfacePoint {
  if (!Array.isArray(value) || value.length !== 2) return false;
  const [x, z] = value;
  return typeof x === 'number' && x >= SURFACE_BOUNDS.minX && x <= SURFACE_BOUNDS.maxX
    && typeof z === 'number' && z >= SURFACE_BOUNDS.minZ && z <= SURFACE_BOUNDS.maxZ;
}

function readPaths(value: unknown, label: string): SurfacePath[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`Missing surface ${label}.`);
  return value.map((path: unknown) => {
    if (!Array.isArray(path) || path.length < 2 || !path.every(pointInCoverage)
        || path.some(([x, z], index) => index > 0 && x === path[index - 1][0] && z === path[index - 1][1])) {
      throw new Error(`Invalid surface ${label} path.`);
    }
    return path;
  });
}

export function parseSurfaceContext(value: unknown): SurfaceContext {
  if (!value || typeof value !== 'object' || !('schemaVersion' in value) || value.schemaVersion !== 1) {
    throw new Error('Unsupported surface context schemaVersion.');
  }
  const { roadEdges, roadMedians, landmarks } = value as Record<string, unknown>;
  if (!Array.isArray(landmarks) || landmarks.length !== LANDMARK_IDS.length) {
    throw new Error('Missing surface landmarks.');
  }
  const validatedLandmarks = LANDMARK_IDS.map((id) => {
    const matches = landmarks.filter((landmark) => landmark && typeof landmark === 'object' && landmark.id === id);
    if (matches.length !== 1 || !pointInCoverage(matches[0].position)) {
      throw new Error(`Invalid surface landmark ${id}.`);
    }
    return { id, position: matches[0].position };
  });
  return {
    schemaVersion: 1,
    roadEdges: readPaths(roadEdges, 'road edge'),
    roadMedians: readPaths(roadMedians, 'road median'),
    landmarks: validatedLandmarks,
  };
}
