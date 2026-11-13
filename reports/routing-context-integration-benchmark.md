# Integrated routing context initialization benchmark

This follows the historical [initial context benchmark](routing-search-context-benchmark.md)
and [initialization study](routing-initialization-study.md). It measures actual
integrated factories after replacing generic graph cloning with a schema-specific
owned snapshot and preparing all five profile scales in one edge sweep.

## Reproduce and baseline provenance

```bash
npm run benchmark:routing:initialization
```

The baseline is the previous reviewed application's `pathfinding.ts` and
`routeService.ts`, captured before this follow-up's edits. It uses the generic
`structuredClone` snapshot, five profile scans, independent per-query scores, and
defensive returned-traversal copies. These frozen benchmark fixtures live under
`scripts/benchmarks/previous-routing-context/`; their README records original
SHA-256 hashes and the import-path-only relocation. This is an integrated-source
baseline, not the earlier study's preparation replica. Shared traversal-resolution
and instruction modules were unchanged during this follow-up.

The graph is built from committed official and reviewed processed data: **1,988
nodes / 2,548 edges**. No raw inputs or generated data derivatives are involved.

## Measurement boundaries

The harness runs five fresh Node processes for each implementation and mode,
rotating implementation order. One mode measures the first context factory call.
The other measures planner creation and the first valid route between the pinned
golden-route places, reporting preparation, route handling, and their combined
time. Imports, JSON parsing, graph construction and process startup precede the
measurement. These are fresh-process Node samples, not cold browser measurements.

In the main process, complete old/new plans are compared before timing. The
repeated workload contains 40 deterministic pairs selected from routable
component-zero places that produce valid, nonempty paths under **all five
profiles**, for 200 requests. Equality includes ordered network routes, total
costs/distances, access legs, geometry, instructions and accessibility warnings.
Three warmup rounds precede 21 measured rounds with rotating runner order.
Repeated service values are per-query averages of 200-request batches; preparation
and new-planner/first-route values time individual calls. No forced GC is used.

Both first-route and repeated service measurements include validation, snapshot
edge resolution, defensive returned-edge cloning, geometry, instructions and
warnings. They exclude React, Three.js, browser startup and rendering. The first
route is the short pinned route; repeated service timings use a broader workload
and must not be directly compared with it.

## Results

Measured on 2026-11-12. Values are medians with p95 in parentheses, in
milliseconds. Cold rows contain five independently started processes; warm rows
contain 21 samples. With only five cold samples, nearest-rank p95 is the maximum
sample, not a reliable tail-latency estimate.

| Actual integrated operation | Previous generic clone / five scans | Current schema copy / one scan |
| --- | ---: | ---: |
| Fresh-process context preparation | 55.524 (68.507) | 22.982 (37.957) |
| Fresh-process planner preparation | 53.354 (75.376) | 24.048 (24.682) |
| Fresh-process first valid route after preparation | 1.979 (6.233) | 1.958 (2.130) |
| Fresh-process factory plus first valid route | 55.333 (77.432) | 26.006 (26.812) |
| Warm context preparation | 38.586 (87.387) | 10.373 (20.139) |
| Warm new factory plus first valid route | 39.013 (55.799) | 10.308 (14.762) |
| Complete repeated route service, per query | 0.916 (2.023) | 0.753 (2.137) |

Observed context preparation was approximately **59% lower** in fresh processes
and **73% lower** after warming. Fresh-process factory plus first valid route was
approximately **53% lower**. The integrated warm setup measured 10.373 ms; the
historical 9.548 ms prototype was a reference, not an acceptance guarantee or a
measurement of this integrated implementation.

The complete service-query median was lower in this run, while its p95 was
slightly higher. The A* loop and routing policy are unchanged in this follow-up;
these measurements do not establish a general repeated-query improvement or a
stable tail-latency bound. A cluster of high samples occurred across runners
around rounds 13–14. No profiler was used to distinguish GC from unrelated load.
All individual and batch-average samples are preserved below.

The original, previous-clone and current snapshots each contain **5,719 distinct
geometry coordinate arrays**, confirming that the integrated copier avoids
replicating shared reverse-traversal coordinates. These counts do not quantify
retained heap bytes. Every one of the 200 complete route plans matched before
timing.

The separate release-verification process measured its single first context at
112.023 ms and its representative short query at 0.085 ms. That one-off sample
was taken during the verification phase rather than this standalone paired run;
it illustrates why isolated points and warm prototype timings cannot substitute
for paired cold measurements.

## Ownership and maintenance

The factory still takes ownership at creation time. The copier retains no caller
aliases for declared mutable graph fields, preserves supplied adjacency and its
order, and memoizes copied edges and geometry coordinates by source identity.
The context does not expose its snapshot and still clones returned traversals.
Graph updates require a replacement context, and React callers replace graph
identity. Initialization remains eager, including an initial empty route request;
no work is deferred into the first search.

The schema-specific helper must be updated when graph types gain nested mutable
fields. It is not a general-purpose clone. It retains a separate graph snapshot;
coordinate-object counts check sharing but do not measure retained heap bytes.
Dijkstra and the one-shot profile preparation remain independent of the new
multi-profile sweep. Routing eligibility, preference costs and A* semantics did
not change.

## Environment and limitations

Measurements use Node v24.20.0 on macOS darwin/x64 (Intel Core i5-4278U at 2.60 GHz),
with dependencies linked from the existing workspace. This runtime is below the
repository's supported v24.22.1 minimum. Supported-runtime and browser/mobile
validation are still needed before interpreting timings as user-visible latency.
No build, lint or test command from this task runs concurrently with the final
benchmark; unrelated system load, JIT and GC can still affect results. Historical
numbers from the earlier reports must not be combined with this run to derive
precise speedups or amortization thresholds.

## Verification

- `npm run build`: passed.
- `npm run lint`: passed.
- `npm test`: the initial unrestricted fork run passed 49 files / 190 tests but
  reported six worker-start timeouts before those files could execute; no test
  assertion failed in that run.
- `npm test -- --maxWorkers=1`: the complete 55 files / 251 tests passed.
- `npm run release:verify`: passed.
- Frozen baseline source hashes were verified after reversing import relocation.
- Independent parent review used a separate temporary script: 60 seeded synthetic
  graphs with all endpoint pairs under five profiles (19,200 comparisons), plus
  2,500 real-graph comparisons. Current ordered results and resolved traversal
  metadata matched the frozen previous context; reachability and total cost
  matched independent Dijkstra. No mismatches or blocking review findings were
  reported. These are bounded samples, not a proof for every graph.
- `npm run data:inspect` and `npm run data:check`: not applicable because local raw
  source inputs are unavailable in this worktree; data outputs did not change.

## Raw timing output

```text
Node v24.20.0; darwin/x64; 1988 nodes/2548 edges.
Baseline: frozen previous integrated source (generic clone / five profile scans), not a study replica.
previous fresh-process context preparation: median 55.524 ms; p95 68.507 ms; samples [66.816, 47.629, 68.507, 53.800, 55.524]
previous fresh-process planner preparation: median 53.354 ms; p95 75.376 ms; samples [64.422, 53.354, 75.376, 52.811, 50.877]
previous fresh-process first valid route after preparation: median 1.979 ms; p95 6.233 ms; samples [6.233, 1.979, 2.056, 1.861, 1.802]
previous fresh-process factory + first valid route: median 55.333 ms; p95 77.432 ms; samples [70.655, 55.333, 77.432, 54.672, 52.680]
current fresh-process context preparation: median 22.982 ms; p95 37.957 ms; samples [37.957, 23.423, 21.834, 22.187, 22.982]
current fresh-process planner preparation: median 24.048 ms; p95 24.682 ms; samples [22.461, 24.682, 24.048, 22.160, 24.405]
current fresh-process first valid route after preparation: median 1.958 ms; p95 2.130 ms; samples [1.783, 2.130, 1.958, 1.789, 2.126]
current fresh-process factory + first valid route: median 26.006 ms; p95 26.812 ms; samples [24.244, 26.812, 26.006, 23.948, 26.532]
Workload: 40 deterministic endpoint pairs / 200 requests; all five profiles; every complete route is valid, nonempty and identical.
previous repeated context preparation: median 38.586 ms; p95 87.387 ms; samples [34.403, 40.927, 42.447, 38.146, 43.593, 59.808, 35.944, 35.773, 36.741, 36.782, 38.130, 35.697, 93.070, 87.387, 46.186, 35.072, 38.586, 44.520, 38.951, 41.902, 35.554]
previous repeated factory + first valid route: median 39.013 ms; p95 55.799 ms; samples [39.013, 42.812, 35.911, 44.248, 48.495, 43.953, 47.249, 35.952, 38.269, 35.667, 37.284, 36.116, 53.637, 49.211, 39.343, 36.079, 38.753, 55.799, 36.014, 58.355, 36.035]
previous repeated complete route-service query: median 0.916 ms; p95 2.023 ms; samples [0.920, 0.973, 0.890, 0.856, 0.932, 0.887, 0.916, 0.856, 0.919, 0.920, 0.862, 0.874, 4.091, 2.023, 1.389, 0.866, 0.868, 1.031, 0.880, 0.969, 0.897] per query (200-request batch averages)
current repeated context preparation: median 10.373 ms; p95 20.139 ms; samples [14.151, 12.478, 8.801, 16.235, 20.139, 13.505, 10.379, 9.546, 12.143, 8.740, 8.588, 8.808, 70.622, 11.406, 9.472, 17.797, 10.373, 10.059, 8.449, 9.498, 8.523]
current repeated factory + first valid route: median 10.308 ms; p95 14.762 ms; samples [10.898, 10.847, 9.164, 21.712, 13.975, 9.538, 9.023, 9.411, 10.308, 8.664, 11.936, 8.722, 14.762, 10.754, 10.838, 10.755, 8.856, 9.471, 10.596, 9.002, 8.900]
current repeated complete route-service query: median 0.753 ms; p95 2.137 ms; samples [0.839, 0.823, 0.818, 0.707, 0.661, 0.934, 0.722, 0.704, 0.682, 0.720, 0.805, 0.788, 2.137, 2.614, 1.646, 0.705, 0.753, 0.691, 0.775, 0.688, 0.664] per query (200-request batch averages)
Distinct coordinate arrays: source=5719, previous clone=5719, integrated snapshot=5719 (object counts, not retained heap bytes).
```
