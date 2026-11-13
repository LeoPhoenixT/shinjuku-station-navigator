# Historical routing initialization cost study

Measured on 2026-11-12 in the routing-search-context worktree. This is a research
follow-up to `routing-search-context-benchmark.md`, not an application change.
At the time of this study the application used `structuredClone` and five profile
scans. That implementation has since been replaced by a schema-specific owned
snapshot and single-sweep scale preparation. See
[routing-context-integration-benchmark.md](routing-context-integration-benchmark.md)
for actual integrated measurements; the study results below remain historical.

## Historical harness

These results came from the prototype version of
`scripts/benchmark-routing-initialization.ts`. The duplicated prototype copier and
preparation replicas have been retired. That path now benchmarks actual integrated
factories; its current output must not be labeled as a rerun of this study.
The previous integrated production source is frozen separately under
`scripts/benchmarks/previous-routing-context/`, with provenance and hashes.

Environment: Node v24.20.0, macOS darwin/x64, the same local machine and linked
dependencies as the preceding benchmark. This Node version is below the
worktree's supported version. Browser/mobile and supported-runtime measurements
remain necessary before interpreting these numbers as user-visible latency.

The harness uses the committed merged graph (1,988 nodes, 2,548 edges), five
warmup rounds, and 41 individually timed calls per variant with rotating order.
The table reports the final run; no other build/test/lint command from this task
ran concurrently. There was no forced GC. System load and GC remain sources of
variation, particularly in p95 values. Stage medians need not add to total medians.

## Results

| Operation | Median ms | p95 ms |
| --- | ---: | ---: |
| `structuredClone` alone | 34.649 | 74.018 |
| Schema-specific copy alone, without sharing copied coordinates | 6.524 | 14.380 |
| Node index alone | 0.193 | 0.393 |
| Preference penalty alone | 0.095 | 0.153 |
| Preparation with five scans (study replica) | 4.190 | 13.882 |
| Preparation with one edge scan (prototype) | 1.562 | 2.985 |
| Existing complete context factory | 40.027 | 73.732 |
| Candidate copy plus five scans | 11.211 | 28.833 |
| Candidate copy plus single scan | 8.474 | 20.865 |
| Candidate shared-coordinate copy plus single scan | **9.548** | **20.502** |

The initial run before adding shared-coordinate copying independently measured
36.719 ms for the existing factory and 8.433 ms for simple copying plus one scan.
The final run supports the same diagnosis: graph copying dominates startup.
The replicas calculate the same profile scales, but are research code; candidate
setup timings do not include production integration or UI rendering.

## Recommended implementation direction

1. Replace generic graph serialization/cloning with a schema-specific owned
   snapshot. Copy nodes, edge scalar metadata, geometry coordinates, accessibility
   arrays, adjacency arrays and rejected-edge records. Memoize copied edge objects
   and copied coordinates by original object identity. Preserve the supplied
   adjacency and its ordering, rather than reconstructing it from `edges`.
2. Calculate straight-line endpoint distance once per edge and update all five
   profile minima in that scan. Keep the existing eligibility, penalty and
   normalization rules. There is no need to change the A* search loop.
3. Preserve factory-time snapshot ownership, independent per-query scores and
   defensive traversal copies. No mutable source data should become reachable
   through the context or its results.

The combined shared-coordinate prototype reduces median setup by about **76%**
in this run. It is slightly slower than the simplest copy, but avoids duplicating
reverse-edge coordinates: the original graph and `structuredClone` each have
5,719 distinct geometry coordinate arrays; simple copying has 11,296; the
shared-coordinate prototype has 5,719. These are object counts, not retained heap
bytes. It still retains a separate graph snapshot.

A dedicated copier must be maintained when the graph schema gains nested mutable
fields. The current prototype covers declared fields; it is not a general-purpose
replacement for `structuredClone`. Production adoption needs focused ownership
tests for every nested mutable field and tests against directed/filtered adjacency.
The existing context update and React lifecycle tests should remain in place.

## Alternatives

- **Lazy profile preparation:** can defer a few milliseconds, but leaves the
  approximately 35 ms generic copy. It is a secondary option, not the primary fix.
- **Delay the entire context until the first request:** removes setup from an
  empty page but moves it to first-route latency. Taking the snapshot later also
  changes factory-time ownership if callers mutate their graph in between.
- **Share the original graph with TypeScript readonly types:** avoids copying but
  does not prevent mutation through existing caller aliases. It weakens the
  contract this enhancement explicitly tests; do not adopt it incidentally.
- **Cache the node map alone:** the measured 0.193 ms stage is too small to address
  the startup bottleneck.

## Validation and scope

The harness verifies deep equality of both candidate snapshots, exact agreement
of all five heuristic scales with the existing implementation, 500 deterministic
route results for each copy candidate against the current one-shot A*, and
resolved traversals for the simple candidate. Both copies also pass destructive
input-mutation probes covering nodes, edge costs, geometry points, accessibility
arrays and adjacency. These are bounded checks on this dataset, not a proof for
all future graphs.

Strict script compilation, ESLint and `git diff --check` passed. Application code
was not changed in this study, so the previous application's full test run was
not repeated. No raw data was read or regenerated. No commits were made during the study.

The 76% figure concerns warm local initialization measurements only. Cold
browser startup, first valid route, retained heap usage and complete production
route-service costs should be measured after integrating the candidate. Do not
combine this run with the earlier query timings to claim a precise amortization
threshold.
