import type { RoutingGraph } from '../graph/types.js';
import { createRouteSearchContext } from './pathfinding.js';

export interface RouteBenchmarkResult { iterations: number; preparationMilliseconds: number; averageMilliseconds: number; lastRouteDistanceMeters: number | null }

export function benchmarkRoute(graph: RoutingGraph, startId: string, goalId: string, iterations = 100): RouteBenchmarkResult {
  const preparationStart = performance.now();
  const context = createRouteSearchContext(graph);
  const preparationMilliseconds = performance.now() - preparationStart;
  const start = performance.now();
  let lastDistance: number | null = null;
  for (let index = 0; index < iterations; index += 1) {
    lastDistance = context.search(startId, goalId)?.distanceMeters ?? null;
  }
  return {
    iterations,
    preparationMilliseconds: Number(preparationMilliseconds.toFixed(3)),
    averageMilliseconds: Number(((performance.now() - start) / iterations).toFixed(3)),
    lastRouteDistanceMeters: lastDistance,
  };
}
