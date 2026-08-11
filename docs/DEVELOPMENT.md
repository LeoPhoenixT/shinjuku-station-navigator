# Development guide

## Purpose

This guide is the operational source of truth for working on Shinjuku Indoor Navigator. It covers a normal public clone, optional GIS regeneration, implementation boundaries, and the checks required before publishing changes.

For the reasoning behind the design, read [PROJECT_DESIGN_AND_IMPLEMENTATION_REVIEW.md](PROJECT_DESIGN_AND_IMPLEMENTATION_REVIEW.md). For the current module layout, read [ARCHITECTURE.md](ARCHITECTURE.md).

## Prerequisites

- Node.js 22 or newer
- npm
- Docker only when validating the production container
- The MLIT R2 Shapefile package only when inspecting or regenerating source-derived data

## Start a public clone

```bash
npm install
npm run dev
```

The committed files under `public/data/processed/` are sufficient to build, test, and run the application. Raw shapefiles are not required for ordinary UI, routing, or deployment work.

## Core design boundaries

Keep dependencies flowing in this direction:

```text
source data and reviewed inputs
        ↓
deterministic TypeScript generators
        ↓
runtime-validated processed JSON
        ↓
graph and routing domain
        ↓
React application state
        ↓
Three.js presentation
```

Follow these rules:

- Keep graph, routing, schemas, formatting, and data-processing logic independent from React and Three.js.
- Treat the official Node/Link network as routing authority.
- Keep reviewed topology additions separate and visibly attributable.
- Treat visual polygons, openings, fixtures, and TWSI as presentation or supporting evidence, not invented pedestrian connectivity.
- Preserve source IDs and raw coded values through processing.
- Represent unknown accessibility explicitly.
- Keep generated files deterministic and never edit them manually.
- Keep UI components accessible, small, and driven by semantic domain values.

## Common change workflows

### UI-only change

1. Identify the owning component or hook under `src/components/`, `src/features/`, or `src/hooks/`.
2. Preserve route IDs, route geometry, and URL state.
3. Add or update focused component tests.
4. Test desktop and mobile behavior when layout changes.
5. Run the standard verification set.

### Routing change

1. Start in `src/graph/` or `src/routing/`, not in the renderer.
2. Add a synthetic test for the rule.
3. Compare Dijkstra and A* where correctness could diverge.
4. Test each affected routing profile.
5. Confirm the underlying official/reviewed topology is not mutated.

### Processed schema change

1. Update `src/schema/processed.ts` or the relevant specialized schema.
2. Update the generator and runtime loader together.
3. Add parser tests for valid and invalid data.
4. Regenerate all registered outputs.
5. Run `npm run data:check` with the local source package.
6. Run `npm run release:verify`.

### Translation change

Follow [INTERNATIONALIZATION.md](INTERNATIONALIZATION.md). Edit the authoring source or UI catalogs, regenerate the translation overlay, and test both locales and bilingual search.

## Optional raw-data workflow

Raw MLIT source materials are ignored local inputs and must never be committed.

1. Download the R2 Shapefile package from <https://www.geospatial.jp/ckan/dataset/mlit-indoor-shinjuku-r2>.
2. Extract it to:

   ```text
   shapefile/新宿駅周辺屋内地図オープンデータ（Shapefile）
   ```

3. Inspect it:

   ```bash
   npm run data:inspect
   npm run data:profile
   ```

4. Regenerate registered outputs only when intentionally changing the pipeline:

   ```bash
   npm run data:build
   npm run data:check
   ```

`data:check` rebuilds into a temporary directory and byte-compares all registered artifacts. It is the preferred non-mutating reproducibility check.

## Generated-data ownership

- `data/` contains reviewed project inputs and provenance.
- `scripts/` owns inspection, conversion, validation, report generation, and release checks.
- `public/data/processed/` contains browser-ready runtime assets.
- `reports/` contains deterministic inspection, coverage, validation, and golden-route evidence.
- `src/schema/` validates processed data before application use.

If a runtime asset is deployed, it must be generated, registered in the deterministic build contract, runtime-validated, and checked by release verification.

## Verification

For ordinary code and documentation changes:

```bash
npm run build
npm run lint
npm test
npm run release:verify
npm run audit:prod
```

For data-pipeline changes with the local raw package:

```bash
npm run data:inspect
npm run data:build
npm run data:check
```

For browser behavior:

```bash
npm run test:e2e
```

For production delivery:

```bash
npm run build
npm run docker:build
docker run --rm -p 8080:8080 shinjuku-indoor-navigator:local
npm run container:verify -- http://127.0.0.1:8080
```

The normal `build` command performs strict TypeScript checking and creates the Vite bundle. The Docker build intentionally runs the bundle-only `build:bundle` command because type checking is already a required quality gate; this avoids repeating the TypeScript compiler's memory peak on constrained image builders. Do not use `build:bundle` as a substitute for the standard verification set.

The Docker build stage gives Node a configurable 768 MB heap; the final Nginx stage does not inherit that setting. Override it only when the builder has enough memory:

```bash
docker build --build-arg NODE_MAX_OLD_SPACE_SIZE=1024 --tag shinjuku-indoor-navigator:local .
```

Vite cannot bundle this application reliably inside a hard 512 MB memory limit. For a 512 MB VPS, build and publish the image in CI and pull it on the VPS, or provide enough swap/build memory. Raising the heap above the machine's available RAM without swap can cause the operating system to terminate the build.

If an optional input or environment is unavailable, report that check as not applicable rather than implying it passed.

## Completion checklist

- The change respects the architecture and data-authority boundaries.
- Tests cover the changed behavior and important failure paths.
- Generated outputs were regenerated only by their owning scripts.
- Public files contain no raw GIS package, source archive, or local reference PDFs.
- Documentation describes current behavior and links to the correct source of truth.
- Standard verification passes.
- Relevant data, browser, or container checks pass or are explicitly documented as not applicable.
