import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import ts from 'typescript';
import { buildOfficialGraph } from '../src/graph/buildOfficialGraph.js';
import { mergeReviewedCustomGraph } from '../src/graph/buildReviewedCustomGraph.js';
import { astar, createRouteSearchContext, ROUTING_PROFILES } from '../src/routing/pathfinding.js';
import { parseNamedPlaces, parseOfficialNetwork } from '../src/schema/processed.js';
import { parseReviewedCustomNetwork } from '../src/schema/reviewedCustomNetwork.js';

const baselineRef = process.argv[2];
if (!baselineRef) throw new Error('Usage: npm run benchmark:routing -- <baseline-git-ref>');
// The baseline is read from Git without modifying either checkout. Its only import
// is type-only; refuse runtime imports so an unrelated implementation fails clearly.
const baselineSource = execFileSync('git', ['show', `${baselineRef}:src/routing/pathfinding.ts`], { encoding: 'utf8' });
const baselineJavaScript = ts.transpileModule(baselineSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
if (/\b(?:import|from)\s*[("']/.test(baselineJavaScript)) throw new Error('Baseline pathfinding must be self-contained after removing type imports.');
const baseline = await import(`data:text/javascript;base64,${Buffer.from(baselineJavaScript).toString('base64')}`) as { astar: typeof astar };
const read = (file: string): unknown => JSON.parse(readFileSync(`public/data/processed/${file}`, 'utf8')) as unknown;
const network = parseOfficialNetwork(read('jr-shinjuku-ticket-gates-b1-official-network.json'));
const reviewed = parseReviewedCustomNetwork(read('shinjuku-reviewed-custom-network.json'), network);
const graph = mergeReviewedCustomGraph(buildOfficialGraph(network), reviewed);
const places = parseNamedPlaces(read('shinjuku-b1-named-places.json'), network, reviewed);
const nodeIds = [...new Set(places.places.filter(({ routable, access }) => routable && access.componentId === 0).map(({ access }) => access.nodeId))].sort();
if (nodeIds.length < 40) throw new Error('Expected at least 40 routable component-zero nodes.');
const requests = Array.from({ length: 40 }, (_, index) => ({
  start: nodeIds[(index * 17) % nodeIds.length],
  goal: nodeIds[(index * 43 + 29) % nodeIds.length],
})).flatMap((pair) => ROUTING_PROFILES.map((profile) => ({ ...pair, profile })));
const context = createRouteSearchContext(graph);
const runners = [
  { name: 'baseline one-shot (preparation included)', run: (request: typeof requests[number]) => baseline.astar(graph, request.start, request.goal, request) },
  { name: 'current one-shot (preparation included)', run: (request: typeof requests[number]) => astar(graph, request.start, request.goal, request) },
  { name: 'reused context (query only)', run: (request: typeof requests[number]) => context.search(request.start, request.goal, request) },
];
// Verify complete ordered route results before timing, including unreachable requests.
for (const request of requests) {
  const expected = runners[0].run(request);
  for (const runner of runners.slice(1)) {
    if (!isDeepStrictEqual(runner.run(request), expected)) throw new Error(`Route differs from baseline: ${JSON.stringify(request)}`);
  }
}
const median = (samples: number[]): number => [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)];
const preparationSamples = Array.from({ length: 9 }, () => {
  const start = performance.now();
  createRouteSearchContext(graph);
  return performance.now() - start;
});
// Two complete warmup workloads per runner; rotate measurement order across seven
// batches to reduce systematic JIT/GC/order effects. No timing assertions in tests.
for (let pass = 0; pass < 2; pass += 1) for (const runner of runners) for (const request of requests) runner.run(request);
const samples = runners.map(() => [] as number[]);
for (let batch = 0; batch < 7; batch += 1) {
  for (let offset = 0; offset < runners.length; offset += 1) {
    const index = (batch + offset) % runners.length;
    const start = performance.now();
    for (const request of requests) runners[index].run(request);
    samples[index].push((performance.now() - start) / requests.length);
  }
}
console.log(`Node ${process.version}; ${process.platform}/${process.arch}; baseline ${baselineRef}`);
console.log(`Graph: ${graph.nodes.length} nodes / ${graph.edges.length} edges; ${requests.length} identical requests, all five profiles; full results match.`);
console.log(`Context preparation (snapshot clone, node lookup, penalty, all profile scales): ${median(preparationSamples).toFixed(3)} ms median / 9 runs.`);
for (const [index, runner] of runners.entries()) console.log(`${runner.name}: ${median(samples[index]).toFixed(3)} ms/query median / 7 batches; batch averages [${samples[index].map((sample) => sample.toFixed(3)).join(', ')}].`);
