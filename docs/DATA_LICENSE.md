# Data licensing and attribution

## Source

This application uses processed derivatives of the Ministry of Land, Infrastructure, Transport and Tourism dataset [新宿駅周辺屋内地図オープンデータ（令和2年度更新版）](https://www.geospatial.jp/ckan/dataset/mlit-indoor-shinjuku-r2).

The [MLIT dataset terms](https://www.geospatial.jp/ckan/dataset/ecabe2e2-21a9-4a72-8dee-0b34e2c34fb6/resource/e3b28fde-5546-4c9d-956b-69363d707835/download/.pdf) are based on the Government Standard Terms of Use, Version 2.0. They identify MLIT's High-Precision Positioning Society Project as the source and require crediting the dataset and describing any processing. [MLIT's 27 October 2020 announcement](https://www.mlit.go.jp/report/press/tochi_fudousan_kensetsugyo17_hh_000001_00002.html) describes the data as freely downloadable for uses including indoor-navigation application development.

## Attribution used by this project

> Processed from 「新宿駅周辺屋内地図オープンデータ（令和2年度更新版）」, Ministry of Land, Infrastructure, Transport and Tourism (MLIT), under the Government Standard Terms of Use. Modified content is not endorsed by MLIT.

The app and README credit the MLIT dataset. Its processed derivatives are distributed under the source terms, and `data/source-manifest.json` records the source URL, local input paths, checksums, and generation provenance.

## Distribution boundary

Raw source files, the original archive, and source-reference PDFs are ignored local development inputs. They are not committed or distributed by this repository. The production artifact contains only application bundles and intentionally processed JSON assets. `npm run release:verify` fails if `.shp`, `.shx`, `.dbf`, `.prj`, or `.cpg` files appear in `dist/`.

## Surface roads

The street-level road layer uses the 1 July 2026 edition of [GSI Optimized Vector Tiles](https://github.com/gsi-cyberjapan/optimal_bvmap). GSI publishes this experimental tile set under the [GSI Content Terms of Use](https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html), which apply Japan's [Public Data License 1.0 (PDL 1.0)](https://www.digital.go.jp/resources/open_data/public_data_license_v1.0) with GSI's attribution requirements.

Shinjuku Station Navigator extracted the road edges and visible medians, clipped them to the station area, and converted them to local map coordinates. The app footer and README credit GSI and identify the project as the processor. The [road snapshot](../data/shinjuku-surface-roads.source.json) records the GSI archive URL, edition, archive ETag, and tile checksums. Both the snapshot and the browser-ready road geometry follow the GSI terms.

The three landmark positions are approximate area references checked against the [Shinjuku City station district plan](https://www.city.shinjuku.lg.jp/content/000340479.pdf), the [GSI map](https://maps.gsi.go.jp/vector/#17/35.6909/139.7006), and the indoor map. They do not define entrances or routes.

The [MIT License](../LICENSE) covers the application code. Each dataset follows the source terms described above.
