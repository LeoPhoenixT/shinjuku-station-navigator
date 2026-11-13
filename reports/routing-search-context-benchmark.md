# Historical routing search context benchmark

Measured on 2026-11-12 against `975d0b2`, using only committed processed data.

This records the first reusable-context implementation, which used generic
`structuredClone` and five profile scans during initialization. Its timings and
amortization estimates are historical. The subsequent schema-specific copier and
single-sweep preparation are measured in
[routing-context-integration-benchmark.md](routing-context-integration-benchmark.md).
The `benchmark:routing` command now runs the current application implementation;
rerunning it does not reproduce this historical implementation's measurements.

## Reproduce

```bash
npm run benchmark:routing -- 975d0b2
```

The script reads the baseline pathfinder from Git, transpiles it in memory, and
compares it with the current one-shot A* and a reusable search context. It does
not change a checkout or regenerate data.

Environment: Node.js v24.20.0, macOS (`darwin/x64`), Intel Core i5-4278U at 2.60 GHz.
Dependencies were reused through a local `node_modules` symlink to the existing
workspace. Node v24.20.0 is below the repository's supported v24.22.1 minimum;
these measurements and passing checks do not replace validation on the supported
CI runtime. No build, lint, or test process from this task ran during this timing
run. Hardware load, JIT compilation, and garbage collection still affect results.

## Workload and results

The merged official/reviewed graph contains **1,988 nodes and 2,548 edges**. The
workload uses 40 deterministic endpoint pairs from routable places in component
zero, each under all five profiles: **200 requests per batch**. Every complete
ordered route result, including costs and distances, matched the baseline before
timing. Each runner receives two full warmup workloads, followed by seven measured
batches with rotating runner order. Values below are medians of batch averages.

| Implementation | Time per query |
| --- | ---: |
| Baseline one-shot A*, including per-query preparation | 2.054 ms |
| Current one-shot A*, including per-query preparation | 1.616 ms |
| Reusable context, query only | 0.921 ms |

The reusable context's separate preparation cost was **37.338 ms**, the median of
nine runs. This includes cloning nodes, edges, adjacency, geometry and metadata,
then building the node lookup, preference penalty, and all five profile scales.
The first context created by `npm run release:verify` took 55.630 ms in its
separate process; its representative short route averaged 0.029 ms over 100 runs.
That representative route is a different workload and must not be compared with
the table above.

Measured per-batch averages, in ms/query:

```text
baseline:  2.217, 2.058, 2.054, 2.298, 1.952, 1.873, 1.887
one-shot:  1.652, 1.616, 1.658, 2.103, 1.524, 1.548, 1.514
context:   0.990, 1.040, 1.000, 0.882, 0.902, 0.912, 0.921
```

## Interpretation and limits

Repeated A* queries used approximately **55% less time** than the baseline on this
workload. A simple amortization estimate is `37.338 / (2.054 - 0.921)`, or about
**33 queries** to recover the context preparation cost relative to the baseline
one-shot API. Against the current sparse-score one-shot API, the estimate is
about 54 queries. These are workload-specific estimates, not browser guarantees.

The planner eagerly prepares its owned snapshot when the loaded
network/graph/places identities change, including an initial page without route
endpoints. It retains a separate graph copy and adds startup work in exchange for
cheaper subsequent searches. This change does not demonstrate faster first-route
latency. Replacing the graph requires a new context; an existing context keeps its
original snapshot even if the caller mutates its source graph.

The table measures A* alone. Production `createRoutePlanner` additionally
validates places, resolves traversals, copies returned edges from the snapshot,
and creates instructions, warnings and geometry. Those per-route costs, React
rendering, and memory usage were not measured here. Dijkstra remains an independent
correctness oracle and is not the performance baseline.

## Verification

- `npm run build`: passed.
- `npm run lint`: passed.
- `npm test`: 54 files / 247 tests passed.
- `npm run release:verify`: passed.
- `npm run data:inspect` and `npm run data:check`: not applicable; raw local source
  inputs are unavailable in this worktree, and no data outputs changed.
