import type { GraphEdge, GraphNode, RoutingGraph } from '../graph/types.js';

export const ROUTING_PROFILES = ['shortest', 'accessible', 'avoid-stairs', 'prefer-elevator', 'fewest-floor-changes'] as const;
export type RoutingProfile = typeof ROUTING_PROFILES[number];

export interface RouteOptions { profile?: RoutingProfile }
export interface RouteResult { nodeIds: string[]; edgeIds: string[]; distanceMeters: number; totalCost: number }

function isEligible(edge: GraphEdge, profile: RoutingProfile): boolean {
  if (profile === 'accessible') return edge.accessibility !== 'no';
  if (profile === 'avoid-stairs') return edge.kind !== 'stairs';
  return true;
}

function preferencePenalty(graph: RoutingGraph): number {
  return graph.edges.reduce((total, edge) => total + Math.max(0, edge.distanceMeters), 0) + 1;
}

function edgeCost(edge: GraphEdge, profile: RoutingProfile, penalty: number): number {
  if (profile === 'fewest-floor-changes' && edge.floorFrom !== edge.floorTo) return edge.distanceMeters + penalty;
  if (profile === 'prefer-elevator' && edge.floorFrom !== edge.floorTo && edge.kind !== 'elevator') return edge.distanceMeters + penalty;
  return edge.distanceMeters;
}

function reconstructRoute(startId: string, goalId: string, totalCost: number, previous: Map<string, { node: string; edge: GraphEdge }>): RouteResult | null {
  const nodeIds = [goalId];
  const edgeIds: string[] = [];
  let distanceMeters = 0;
  for (let cursor = goalId; cursor !== startId;) {
    const step = previous.get(cursor);
    if (!step) return null;
    edgeIds.push(step.edge.id.replace(/:reverse$/, ''));
    distanceMeters += step.edge.distanceMeters;
    cursor = step.node;
    nodeIds.push(cursor);
  }
  nodeIds.reverse();
  edgeIds.reverse();
  return { nodeIds, edgeIds, distanceMeters: Number(distanceMeters.toFixed(3)), totalCost: Number(totalCost.toFixed(3)) };
}

interface QueueEntry { id: string; priority: number }

class MinQueue {
  private readonly entries: QueueEntry[] = [];

  get size(): number { return this.entries.length; }

  push(entry: QueueEntry): void {
    this.entries.push(entry);
    let index = this.entries.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (compareQueue(this.entries[parent], entry) <= 0) break;
      this.entries[index] = this.entries[parent];
      index = parent;
    }
    this.entries[index] = entry;
  }

  pop(): QueueEntry | undefined {
    const first = this.entries[0];
    const last = this.entries.pop();
    if (!first || !last || this.entries.length === 0) return first;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.entries.length) break;
      const child = right < this.entries.length && compareQueue(this.entries[right], this.entries[left]) < 0 ? right : left;
      if (compareQueue(last, this.entries[child]) <= 0) break;
      this.entries[index] = this.entries[child];
      index = child;
    }
    this.entries[index] = last;
    return first;
  }
}

function compareQueue(a: QueueEntry, b: QueueEntry): number {
  return a.priority - b.priority || a.id.localeCompare(b.id);
}

export function dijkstra(graph: RoutingGraph, startId: string, goalId: string, options: RouteOptions = {}): RouteResult | null {
  if (!graph.adjacency[startId] || !graph.adjacency[goalId]) return null;
  const distance = new Map<string, number>(graph.nodes.map((node) => [node.id, Number.POSITIVE_INFINITY]));
  const previous = new Map<string, { node: string; edge: GraphEdge }>();
  const profile = options.profile ?? 'shortest';
  const penalty = preferencePenalty(graph);
  const queue = new MinQueue();
  distance.set(startId, 0);
  queue.push({ id: startId, priority: 0 });
  while (queue.size > 0) {
    const entry = queue.pop();
    if (!entry || entry.priority !== distance.get(entry.id)) continue;
    const current = entry.id;
    if (current === goalId) break;
    for (const edge of graph.adjacency[current] ?? []) {
      if (!isEligible(edge, profile)) continue;
      const candidate = (distance.get(current) ?? Infinity) + edgeCost(edge, profile, penalty);
      if (candidate < (distance.get(edge.to) ?? Infinity)) {
        distance.set(edge.to, candidate);
        previous.set(edge.to, { node: current, edge });
        queue.push({ id: edge.to, priority: candidate });
      }
    }
  }
  const total = distance.get(goalId) ?? Infinity;
  return Number.isFinite(total) ? reconstructRoute(startId, goalId, total, previous) : null;
}

function nodeById(graph: RoutingGraph): Map<string, GraphNode> {
  return new Map(graph.nodes.map((node) => [node.id, node]));
}

function euclideanHeuristic(nodes: Map<string, GraphNode>, from: string, to: string): number {
  const a = nodes.get(from);
  const b = nodes.get(to);
  if (!a || !b) return 0;
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

export function admissibleHeuristicScale(graph: RoutingGraph, options: RouteOptions = {}): number {
  const nodes = nodeById(graph);
  const profile = options.profile ?? 'shortest';
  const penalty = preferencePenalty(graph);
  let scale = Number.POSITIVE_INFINITY;
  for (const edge of graph.edges) {
    if (!isEligible(edge, profile)) continue;
    const straightDistance = euclideanHeuristic(nodes, edge.from, edge.to);
    if (straightDistance === 0) continue;
    scale = Math.min(scale, edgeCost(edge, profile, penalty) / straightDistance);
  }
  return Number.isFinite(scale) ? Math.max(0, scale) : 0;
}

export function astar(graph: RoutingGraph, startId: string, goalId: string, options: RouteOptions = {}): RouteResult | null {
  if (!graph.adjacency[startId] || !graph.adjacency[goalId]) return null;
  const nodes = nodeById(graph);
  const heuristicScale = admissibleHeuristicScale(graph, options);
  const queue = new MinQueue();
  const gScore = new Map<string, number>(graph.nodes.map((node) => [node.id, Number.POSITIVE_INFINITY]));
  const fScore = new Map<string, number>(graph.nodes.map((node) => [node.id, Number.POSITIVE_INFINITY]));
  const previous = new Map<string, { node: string; edge: GraphEdge }>();
  const profile = options.profile ?? 'shortest';
  const penalty = preferencePenalty(graph);
  gScore.set(startId, 0);
  const initialScore = heuristicScale * euclideanHeuristic(nodes, startId, goalId);
  fScore.set(startId, initialScore);
  queue.push({ id: startId, priority: initialScore });
  while (queue.size > 0) {
    const entry = queue.pop();
    if (!entry || entry.priority !== fScore.get(entry.id)) continue;
    const current = entry.id;
    if (current === goalId) return reconstructRoute(startId, goalId, gScore.get(goalId) ?? Infinity, previous);
    for (const edge of graph.adjacency[current] ?? []) {
      if (!isEligible(edge, profile)) continue;
      const candidate = (gScore.get(current) ?? Infinity) + edgeCost(edge, profile, penalty);
      if (candidate < (gScore.get(edge.to) ?? Infinity)) {
        previous.set(edge.to, { node: current, edge });
        gScore.set(edge.to, candidate);
        const score = candidate + heuristicScale * euclideanHeuristic(nodes, edge.to, goalId);
        fScore.set(edge.to, score);
        queue.push({ id: edge.to, priority: score });
      }
    }
  }
  return null;
}
