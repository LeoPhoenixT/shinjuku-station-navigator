// Actual integrated factories; the earlier research replicas have been retired.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { buildOfficialGraph } from '../src/graph/buildOfficialGraph.js';
import { mergeReviewedCustomGraph } from '../src/graph/buildReviewedCustomGraph.js';
import { snapshotRoutingGraph } from '../src/graph/snapshotRoutingGraph.js';
import type { RoutingGraph } from '../src/graph/types.js';
import { createRouteSearchContext, ROUTING_PROFILES } from '../src/routing/pathfinding.js';
import { createRoutePlanner } from '../src/routing/routeService.js';
import { parseNamedPlaces, parseOfficialNetwork } from '../src/schema/processed.js';
import { parseReviewedCustomNetwork } from '../src/schema/reviewedCustomNetwork.js';
import { createRouteSearchContext as previousContext } from './benchmarks/previous-routing-context/pathfinding.js';
import { createRoutePlanner as previousPlanner } from './benchmarks/previous-routing-context/routeService.js';

const read = (name: string): unknown => JSON.parse(readFileSync(`public/data/processed/${name}`, 'utf8')) as unknown;
const network = parseOfficialNetwork(read('jr-shinjuku-ticket-gates-b1-official-network.json'));
const reviewed = parseReviewedCustomNetwork(read('shinjuku-reviewed-custom-network.json'), network);
const graph = mergeReviewedCustomGraph(buildOfficialGraph(network), reviewed);
const places = parseNamedPlaces(read('shinjuku-b1-named-places.json'), network, reviewed).places;
const golden = JSON.parse(readFileSync('reports/human-golden-route.json', 'utf8')) as { start: { placeId: string }; destination: { placeId: string } };
const implementations = [
  { name: 'previous', context: previousContext, planner: previousPlanner },
  { name: 'current', context: createRouteSearchContext, planner: createRoutePlanner },
] as const;

// Each worker makes exactly one measured factory call after loading/parsing the
// same data. Process startup, imports, graph construction and JSON parsing are
// excluded. This is fresh-process Node behavior, not cold browser startup.
if (process.argv[2] === '--worker') {
  const implementation = implementations.find(({ name }) => name === process.argv[3]);
  if (!implementation) throw new Error('Unknown worker implementation.');
  const start = performance.now();
  if (process.argv[4] === 'context') {
    implementation.context(graph);
    console.log(JSON.stringify({ preparation: performance.now() - start }));
  } else {
    const planner = implementation.planner(network, graph, places);
    const prepared = performance.now();
    const route = planner(golden.start.placeId, golden.destination.placeId);
    const finished = performance.now();
    if (route.status !== 'ok' || route.network.edgeIds.length === 0) throw new Error('Expected a valid first route.');
    console.log(JSON.stringify({ preparation: prepared - start, query: finished - prepared, total: finished - start }));
  }
  process.exit(0);
}

const median = (samples: number[]): number => [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)];
const p95 = (samples: number[]): number => [...samples].sort((a, b) => a - b)[Math.ceil(samples.length * 0.95) - 1];
const describe = (samples: number[]): string => `median ${median(samples).toFixed(3)} ms; p95 ${p95(samples).toFixed(3)} ms; samples [${samples.map((value) => value.toFixed(3)).join(', ')}]`;
console.log(`Node ${process.version}; ${process.platform}/${process.arch}; ${graph.nodes.length} nodes/${graph.edges.length} edges.`);
console.log('Baseline: frozen previous integrated source (generic clone / five profile scans), not a study replica.');
const cold = implementations.map(() => ({ context: [] as number[], preparation: [] as number[], query: [] as number[], total: [] as number[] }));
for (let round = 0; round < 5; round += 1) {
  for (let offset = 0; offset < implementations.length; offset += 1) {
    const index = (round + offset) % implementations.length;
    const implementation = implementations[index];
    for (const mode of ['context', 'route']) {
      const result = JSON.parse(execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--worker', implementation.name, mode], { encoding: 'utf8' })) as { preparation: number; query?: number; total?: number };
      if (mode === 'context') cold[index].context.push(result.preparation);
      else {
        cold[index].preparation.push(result.preparation);
        cold[index].query.push(result.query!);
        cold[index].total.push(result.total!);
      }
    }
  }
}
for (const [index, implementation] of implementations.entries()) {
  console.log(`${implementation.name} fresh-process context preparation: ${describe(cold[index].context)}`);
  console.log(`${implementation.name} fresh-process planner preparation: ${describe(cold[index].preparation)}`);
  console.log(`${implementation.name} fresh-process first valid route after preparation: ${describe(cold[index].query)}`);
  console.log(`${implementation.name} fresh-process factory + first valid route: ${describe(cold[index].total)}`);
}

const planners = implementations.map(({ planner }) => planner(network, graph, places));
const candidates = [...new Map(places.filter(({ routable, access }) => routable && access.componentId === 0 && access.accessibility !== 'no').map((place) => [place.access.nodeId, place])).values()].sort((a, b) => a.id.localeCompare(b.id));
const requests: Array<{ start: string; goal: string; profile: typeof ROUTING_PROFILES[number] }> = [];
const pairs = new Set<string>();
for (let attempt = 0; requests.length < 200 && attempt < candidates.length * 10; attempt += 1) {
  const start = candidates[(attempt * 17) % candidates.length];
  const goal = candidates[(attempt * 43 + 29) % candidates.length];
  const key = `${start.id}|${goal.id}`;
  if (start.id === goal.id || pairs.has(key)) continue;
  const group = ROUTING_PROFILES.map((profile) => ({ start: start.id, goal: goal.id, profile }));
  const results = group.map((request) => planners[0](request.start, request.goal, request.profile));
  if (results.some((result) => result.status !== 'ok' || result.network.edgeIds.length === 0)) continue;
  for (const [index, request] of group.entries()) {
    if (!isDeepStrictEqual(planners[1](request.start, request.goal, request.profile), results[index])) throw new Error(`Complete route differs: ${JSON.stringify(request)}`);
  }
  pairs.add(key);
  requests.push(...group);
}
if (requests.length !== 200) throw new Error('Could not form 40 valid nonempty routes under all five profiles.');
console.log(`Workload: ${pairs.size} deterministic endpoint pairs / ${requests.length} requests; all five profiles; every complete route is valid, nonempty and identical.`);

const runners = implementations.flatMap((implementation, index) => [
  { name: `${implementation.name} repeated context preparation`, run: () => { implementation.context(graph); } },
  { name: `${implementation.name} repeated factory + first valid route`, run: () => { implementation.planner(network, graph, places)(golden.start.placeId, golden.destination.placeId); } },
  { name: `${implementation.name} repeated complete route-service query`, run: () => { for (const request of requests) planners[index](request.start, request.goal, request.profile); }, divisor: requests.length },
]);
for (let round = 0; round < 3; round += 1) for (const runner of runners) runner.run();
const samples = runners.map(() => [] as number[]);
for (let round = 0; round < 21; round += 1) {
  for (let offset = 0; offset < runners.length; offset += 1) {
    const index = (round + offset) % runners.length;
    const start = performance.now();
    runners[index].run();
    samples[index].push((performance.now() - start) / (runners[index].divisor ?? 1));
  }
}
for (const [index, runner] of runners.entries()) console.log(`${runner.name}: ${describe(samples[index])}${runner.divisor ? ' per query (200-request batch averages)' : ''}`);
const snapshot = snapshotRoutingGraph(graph);
if (!isDeepStrictEqual(snapshot, graph)) throw new Error('Integrated snapshot differs from source.');
const pointCount = (source: RoutingGraph): number => new Set([...source.edges, ...Object.values(source.adjacency).flat()].flatMap(({ geometry }) => geometry)).size;
console.log(`Distinct coordinate arrays: source=${pointCount(graph)}, previous clone=${pointCount(structuredClone(graph))}, integrated snapshot=${pointCount(snapshot)} (object counts, not retained heap bytes).`);
