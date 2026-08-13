# Shinjuku Station Navigator

A 3D station navigation and pathfinding application for the MLIT Shinjuku Station indoor map dataset.

## Current capabilities

- Multi-floor 3D station visualization
- Pedestrian graph loading and validation
- A* route calculation
- Accessible routing profiles
- Searchable exits, gates, platforms, and facilities
- Shareable route URLs and production-artifact verification
- Route summaries with turn and floor-transition instructions
- Reproducible Docker/Nginx delivery with security and health checks
- Crawlable English and Japanese entry pages with localized search and social metadata

## Stack

- Vite
- React
- TypeScript
- React Three Fiber / Three.js
- Vitest
- Playwright
- Nginx

## Development

```bash
npm install
npm run dev
```

Other useful commands:

```bash
npm run build
npm run lint
npm run test
npm run test:coverage
npm run test:e2e
npm run release:verify
npm run audit:prod
```

## Production container

```bash
npm run docker:build
docker run --rm -p 8080:8080 shinjuku-station-navigator:local
```

The application is served at `http://localhost:8080` and exposes `GET /healthz`. In another terminal, run `npm run container:verify` to check the SPA fallback, processed data, security headers, and raw-source exclusion.

## Documentation

Start with the [documentation index](docs/README.md). It links to the development workflow, current architecture and UI, data contracts and licensing, internationalization rules, and remaining roadmap.

## Data

The public repository includes the browser-ready derivatives under `public/data/processed/`, so a clean clone can install, test, build, and run the application without the raw GIS package.

Raw MLIT source files are intentionally not tracked or distributed by this repository. To inspect or deterministically regenerate the processed data:

1. Download the R2 Shapefile package from the [official G Spatial Information Center dataset page](https://www.geospatial.jp/ckan/dataset/mlit-indoor-shinjuku-r2).
2. Extract it locally to `shapefile/新宿駅周辺屋内地図オープンデータ（Shapefile）`.
3. Run `npm run data:inspect`, `npm run data:build`, and `npm run data:check`.

The ignored `shapefile/`, `shapefile.zip`, and source-reference PDFs are local-only inputs. Never add them to a public commit. `data/source-manifest.json` records source provenance and checksums, while `npm run release:verify` validates the committed runtime assets without requiring the raw package.

## Attribution

This project uses processed data derived from [新宿駅周辺屋内地図オープンデータ（令和2年度更新版）](https://www.geospatial.jp/ckan/dataset/mlit-indoor-shinjuku-r2), published by Japan's Ministry of Land, Infrastructure, Transport and Tourism under the Government Standard Terms of Use. Modified processing and application behavior are this project's responsibility and are not endorsed by MLIT.

「新宿駅周辺屋内地図データ」（国土交通省）を加工して作成

## Security

Report suspected vulnerabilities privately through GitHub's **Report a vulnerability** option. See [SECURITY.md](SECURITY.md) for the disclosure policy.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for project boundaries, required checks, and pull-request expectations.

## License

The application source code is licensed under the [MIT License](LICENSE). Processed MLIT-derived data remains subject to the source terms and attribution described in [docs/DATA_LICENSE.md](docs/DATA_LICENSE.md).
