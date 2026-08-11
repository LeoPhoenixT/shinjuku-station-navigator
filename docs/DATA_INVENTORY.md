# Data inventory

## Source dataset

- Dataset: MLIT Shinjuku Station area indoor map open data, R2 Shapefile package.
- Expected local source root: `shapefile/新宿駅周辺屋内地図オープンデータ（Shapefile）`.
- Public source page: <https://www.geospatial.jp/ckan/dataset/mlit-indoor-shinjuku-r2>.
- Recorded project acquisition date: 15 July 2026. The original browser-download metadata was not retained, so the manifest states this evidence explicitly rather than inventing a more precise timestamp.
- Attribution/licensing: attribution text and the confirmed distribution boundary are recorded in `data/source-manifest.json` and `docs/DATA_LICENSE.md`.

## Inspector output

`scripts/inspect-dataset.ts`, exposed through `npm run data:inspect`, writes `reports/dataset-inspection.json` with deterministic metadata (`generatedAt` is fixed for stable diffs), including shapefile companions, geometry type, feature count, bounds, DBF schema, text encoding hints, CRS WKT, routing layers, and routing feasibility.

Current inspection summary:

- Shapefile groups: 241.
- Valid groups with `.shp`, `.shx`, `.dbf`, and `.prj`: 241.
- Missing required companion files: 0.
- Routing feasibility classification: **Official Node/Link data confirmed**.
- Official routing candidates:
  - `新宿駅周辺屋内地図オープンデータ（Shapefile）/nw/Shinjuku_node`
  - `新宿駅周辺屋内地図オープンデータ（Shapefile）/nw/Shinjuku_link`

## CRS and coordinate notes

All inspected `.prj` files use JGD2011 geographic coordinates with degree units, represented as `GEOGCS["GCS_JGD_2011", ... UNIT["Degree",0.0174532925199433]]`. The import pipeline projects these longitude/latitude coordinates into a local metre-based scene coordinate system before measurement, rendering, or routing.

The source WKT does not encode an explicit authority axis order. For this audit, shapefile coordinate tuples are treated as traditional GIS X/Y order: longitude first, latitude second. This must be validated against known Shinjuku bounds during coordinate-transform implementation.

## Encodings

Some groups include `.cpg` files, commonly `UTF-8`; many groups do not. When `.cpg` is absent, the inspector records `unspecified (DBF code page byte only)` and only decodes DBF field names as Latin-1-compatible header bytes. Full attribute value decoding should be handled in a later importer with explicit encoding tests.

## Layer observations

The locally acquired source package contains facility subdirectories for station/operator areas and floor subdirectories such as `B3`, `B2`, `B1`, `0`, `1`, `2`, `2out`, `3`, `3out`, `4`, and `4out`. Layer names include Floor, Space, Opening, Facility, Fixture, Drawing, TWSI line/point, plus the top-level `nw` Node/Link network.

The deterministic vertical-slice fixture uses `1.JR新宿駅改札`. Its inspected floors include `B1`, `0`, `1`, `2`, and `2out`; `B1` includes Opening and TWSI layers in addition to Floor, Space, Drawing, and Facility layers.

## Routing feasibility decision

**Official Node/Link data confirmed.** The locally acquired package includes `nw/Shinjuku_node` and `nw/Shinjuku_link` shapefile groups with complete required companions. Graph construction uses this official network after applying the documented coordinate, floor, and source-ID conventions.

## Semantic profile

Run `npm run data:profile` to generate the deterministic `reports/map-semantics-profile.json`. This profiles values and null rates without modifying source data.

### Official pedestrian network

The field names and observed codes match MLIT's [2018 Walking Space Network Data Development Specification](https://www1.mlit.go.jp/common/001244374.pdf), the contemporary specification for this R2 dataset. The specification confirms the following meanings; a later 2024 revision exists but must not be substituted silently for this source dataset.

- Nodes: 1,982.
- Links: 2,541.
- Node `ordinal` is the floor/vertical order and has 14 values from `-3` through `4.5`; decimals represent intermediate levels. Its relationship to each facility's displayed floor label still needs spatial validation.
- Node `in_out`: `1` facility exterior, `2` boundary, `3` facility interior.
- Link `direction`: `1` both directions (2,470 links), `2` start-to-end (71 links), `3` end-to-start, `99` unknown.
- Link `route_type`: `1` no special type, `2` moving walkway, `3` railway crossing, `4` elevator, `5` escalator, `6` stairs, `7` ramp, `99` unknown. This dataset contains `1`, `4`, `5`, and `6`.
- Link `elevator`: `1` none, `2` present without accessibility equipment, `3` wheelchair equipped, `4` visually-impaired equipped, `5` both, `99` unknown. This dataset contains `1`, `2`, `3`, and `99`.
- Link `distance` is metres. Agreement with projected geometry must still be tested before using it as the cost oracle.
- Width, slope, level difference, tactile guidance, route structure, roof, and traffic-signal codes are also defined by the same specification and are recorded in the generated profile.

Structural identifiers and categorical meanings are now documented. Dataset-specific alignment, topology, floor-label mapping, and geometry-distance agreement still require validation before the official graph is considered production-ready.

### Visible and searchable layers

| Layer | Features | Categories | Named coverage | Initial product use |
| --- | ---: | ---: | ---: | --- |
| Facility | 639 | 18 | 174 named (27.2%; many code-like) | 637 useful-category marker candidates are audited; 464 are public-marker eligible and promoted as high/medium-confidence destinations, while 173 remain review-only. |
| Space | 1,153 | 20 | 486 named (42.2%) | Public/restricted areas and named facilities. |
| Fixture | 608 | 2 | 0 named | Background geometry with authoritative category definitions from the 2018 indoor geospatial data specification. |
| Floor | 200 | 2 | 200 named (100%) | Floor footprints and Japanese floor labels. |
| Opening | 63 | no category field | 56 named (88.9%) | Strong candidates for named gates and entrances. |
| Drawing | 996 | source linework | not destination-oriented | Optional structural-detail overlay across the complete source coverage. |
| TWSI line/point | 728 | tactile guidance | sparse source names | Debug/accessibility alignment overlay; never substituted for the official pedestrian network. |

Opening names include recognizable gates such as `西改札`, `東改札`, `中央東改札`, `南改札`, `東南改札`, `甲州街道改札`, and `新南口改札`. Space names include toilets and source identifiers for some elevators and escalators. Names such as `不明` and bare numbers must not be exposed as useful destinations without curation.

### Current decision

The TWSI graph remains a debug/alignment fixture. Consumer routing uses the imported and validated official Node/Link network. TWSI lines may be shown only as a separate tactile-guidance overlay.

The deterministic official B1 fixture is generated by `npm run data:network` and checked by `npm run data:network:validate`. It contains 147 nodes and 172 links; its processed metadata and validation report retain the selection and source evidence.

## Remaining source-data limitations

1. The public repository excludes the raw source package and source-reference PDFs. Developers who need to regenerate data must download them locally.
2. The exact browser-download timestamp cannot be reconstructed; the repository acquisition date and its evidence are preserved instead.
3. The separate visible-layer `B*`, `C*`, and `F*` category codes are defined by the local source-package reference `製品仕様書.pdf`, tables 8.1.4, 8.1.5, and 8.3.1. The framework-independent registry is implemented in `src/data/indoorMapCategories.ts`; tactile Fixture categories remain intentionally outside the current enhancement scope.
