# Contributing

Thank you for helping improve Shinjuku Station Navigator.

## Before opening a change

- Open an issue before proposing a large behavioral, routing, data-model, or data-source change.
- Do not commit raw MLIT shapefiles, source archives, local reference PDFs, credentials, personal data, or generated files not owned by the documented build pipeline.
- Keep routing and data-processing logic independent from React and Three.js.
- Preserve source provenance, stable identifiers, accessibility uncertainty, and the distinction between official and reviewed topology.

## Development workflow

Use Node.js 22 or newer, then install dependencies and run the development server:

```bash
npm install
npm run dev
```

Before opening a pull request, run:

```bash
npm run build
npm run lint
npm test
npm run release:verify
npm run audit:prod
```

Run the data inspection and reproducibility commands only when the ignored local source package is available. See [the development guide](docs/DEVELOPMENT.md) for the complete workflow.

## Pull requests

- Keep each pull request narrowly scoped and explain the user-visible or data-contract impact.
- Add focused tests for behavior changes.
- Update durable documentation when commands, architecture, data contracts, licensing, or UI behavior change.
- State which verification commands passed and identify checks that were not applicable.

By contributing, you agree that your contribution is licensed under this repository's [MIT License](LICENSE).
