import type { RoutingGraph } from '../graph/types.js';
import { astar } from './pathfinding.js';

export interface RouteBenchmarkResult { iterations: number; averageMilliseconds: number; lastRouteDistanceMeters: number | null }

export function benchmarkRoute(graph: RoutingGraph, startId: string, goalId: string, iterations = 100): RouteBenchmarkResult {
  const start = performance.now();
  let lastDistance: number | null = null;
  for (let index = 0; index < iterations; index += 1) {
    lastDistance = astar(graph, startId, goalId)?.distanceMeters ?? null;
  }
  return {
    iterations,
    averageMilliseconds: Number(((performance.now() - start) / iterations).toFixed(3)),
    lastRouteDistanceMeters: lastDistance,
  };
}
