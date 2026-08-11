# Documentation

This directory contains the durable public documentation for Shinjuku Indoor Navigator. Historical phase reports and completed implementation plans are intentionally omitted so the documentation stays focused on the current system.

## Start here

| Document | Use it for |
| --- | --- |
| [Development guide](DEVELOPMENT.md) | Setting up the project, making changes, regenerating data, and running quality gates |
| [Architecture](ARCHITECTURE.md) | Current module boundaries, runtime flow, routing authority, and deployment shape |
| [Current UI guide](CURRENT_UI_GUIDE.md) | Public controls, map layers, route presentation, and debug behavior |
| [Internationalization](INTERNATIONALIZATION.md) | English/Japanese UI and data-translation rules |
| [Roadmap](ROADMAP.md) | Verified remaining improvements rather than completed historical work |

## Data references

| Document | Use it for |
| --- | --- |
| [Data model](DATA_MODEL.md) | Processed schemas, coordinates, graph fields, places, and translations |
| [Data inventory](DATA_INVENTORY.md) | Source-package contents, inspection results, and known source limitations |
| [Data licensing](DATA_LICENSE.md) | Attribution, redistribution, and public-release boundaries |

## Documentation rules

- Describe the current system in the present tense.
- Put unfinished work in `ROADMAP.md`; do not create another phase report.
- Update generated counts only from checked reports or verification output.
- Keep local raw-source paths clearly marked as optional and ignored.
- Link to code and machine-readable reports instead of copying large tables.
- Remove obsolete instructions when behavior changes.
