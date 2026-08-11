# Agent Instructions

## Scope

These instructions apply to the entire repository.

## Project workflow

- Read `docs/DEVELOPMENT.md`, `docs/ARCHITECTURE.md`, and the relevant current guide before changing implementation code.
- Keep raw source data under the ignored, local-only `shapefile/` directory immutable unless a human explicitly requests a data refresh.
- Never commit `shapefile/`, `shapefile.zip`, or the local source-reference PDFs ignored by `.gitignore`.
- Do not place raw shapefiles or generated raw-data derivatives under `public/`.
- Prefer deterministic generated outputs and document how to reproduce them.

## Code style

- Use TypeScript with strict checking for application and tooling code.
- Keep routing/data-processing logic independent from React and Three.js.
- Avoid try/catch around imports.
- Keep UI components small and accessible; provide semantic labels for viewer regions and controls.

## Verification

Run the commands relevant to the current phase before opening a PR:

```bash
npm run build
npm run lint
npm test
npm run release:verify
```

Run `npm run data:inspect` and `npm run data:check` only when the local raw source package is available. If a phase command does not exist or its local-only input is unavailable, document it as not applicable in the PR.
