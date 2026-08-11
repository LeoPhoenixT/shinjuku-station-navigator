# Data licensing and attribution

## Source

This application uses processed derivatives of the Ministry of Land, Infrastructure, Transport and Tourism dataset [新宿駅周辺屋内地図オープンデータ（令和2年度更新版）](https://www.geospatial.jp/ckan/dataset/mlit-indoor-shinjuku-r2).

The G Spatial Information Center catalog identifies the dataset license as the Government Standard Terms of Use. MLIT's 27 October 2020 announcement describes the data as freely downloadable for uses including indoor-navigation application development.

## Attribution used by this project

> Processed from 「新宿駅周辺屋内地図オープンデータ（令和2年度更新版）」, Ministry of Land, Infrastructure, Transport and Tourism (MLIT), under the Government Standard Terms of Use. Modified content is not endorsed by MLIT.

The attribution is visible in the application and README. The source URL and checksum inventory are recorded in `data/source-manifest.json`.

## Distribution boundary

Raw source files, the original archive, and source-reference PDFs are ignored local development inputs. They are not committed or distributed by this repository. The production artifact contains only application bundles and intentionally processed JSON assets. `npm run release:verify` fails if `.shp`, `.shx`, `.dbf`, `.prj`, or `.cpg` files appear in `dist/`.

The processed derivatives under `public/data/processed/` are distributed with the attribution above. Their source URL, expected local source root, checksums, and generation provenance remain recorded in `data/source-manifest.json`.

The project does not imply that MLIT produced, reviewed, or endorses its modified data, routing policies, or navigation results.
