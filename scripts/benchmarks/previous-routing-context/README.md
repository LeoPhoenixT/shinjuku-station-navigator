# Frozen integrated routing-context baseline

These benchmark-only fixtures capture the previously reviewed, uncommitted
implementation immediately before the schema-specific snapshot and single-sweep
preparation change on 2026-11-12. They are actual application source, not the
initialization study's replica. Keep them frozen; they are not a maintained
routing implementation and are never imported by application code or tests.

Original source SHA-256 values before import relocation:

- `src/routing/pathfinding.ts`: `9cdf8f60fa5b2db8b3e32346b0a363cc62b3cccb47fdaf5be5267e96d4b26646`
- `src/routing/routeService.ts`: `82dbaf17ee2b771b6fe00f3fafab2cd6f09ceadb61f5bdc698cbcbd7408e8239`

Only import paths were relocated. The pathfinder still creates its snapshot with
`structuredClone`, prepares five profile scales separately, and defensively
clones returned traversals. Its route service imports that frozen pathfinder.
Graph types, schema types, traversal resolution and instruction generation are
shared with the application; those modules did not change in this follow-up.

The fixtures compile under `tsconfig.scripts.json`; coverage includes only
`src/schema/`, `src/graph/` and `src/routing/`, so these scripts are excluded.
The integrated benchmark compares full results before timing. Changes to shared
modules in the future must be disclosed when interpreting this baseline.
