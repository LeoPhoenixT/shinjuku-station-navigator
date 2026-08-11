# Current Data Model

The original single-floor format described below remains a supported deterministic fixture. The production application additionally loads the full visual map, complete official pedestrian network, separately reviewed custom-network overlay, and expanded named-place catalog. All runtime formats are versioned and validated in `src/schema/processed.ts`.

## Selected vertical slice

The vertical-slice converter imports `1.JR新宿駅改札/B1` from the locally acquired, ignored MLIT Shinjuku R2 shapefile package. The deterministic browser-ready output is written to `public/data/processed/jr-shinjuku-ticket-gates-b1.json` by `npm run data:convert`.

## Coordinate convention

Source shapefile coordinates are interpreted as JGD2011 longitude/latitude tuples in traditional GIS order: X is longitude and Y is latitude. The processed output uses local metres with a stable origin at longitude `139.7006`, latitude `35.6909` near Shinjuku Station.

Scene axes are fixed as:

- `x`: metres east of the local origin.
- `y`: vertical metres.
- `z`: metres south of the local origin, represented as negative northing.

The converter uses a deterministic local equirectangular approximation around the origin. It is appropriate for compact station geometry and avoids mixing degree coordinates with route or scene distances. Floor elevations are rendering offsets only: `B1` is `-5` metres.

## Processed dataset schema

The processed JSON root contains:

- `schemaVersion`: currently `1`.
- `importerVersion`: deterministic importer identifier.
- `generatedAt`: fixed timestamp for byte-identical output.
- `source`: selected facility, floor, source directory, and input checksums.
- `coordinateSystem`: CRS WKT, local origin, metre units, and scene axes.
- `layers`: feature counts and imported DBF fields by layer.
- `features`: stable sorted feature records.
- `statistics`: imported/skipped/malformed counts and local-metre coordinate bounds.

Each feature contains:

- `id`: stable processed ID built from facility, floor, layer, and source ID.
- `sourceId`: original source `id` DBF field when present.
- `sourceRecord`: one-based shapefile record number.
- `layer`: source layer name.
- `geometry`: local-metre point, polyline, or polygon coordinates.
- `properties`: deterministically sorted source properties preserved for provenance.

## Field mapping

| Source layer | Geometry | Imported fields | Processed mapping |
| --- | --- | --- | --- |
| `JrSin_B1_Floor` | Polygon | `id`, `category`, `name`, `ordinal`, `short_name`, `source` | Preserved in `properties`; `id` becomes part of stable processed feature ID. |
| `JrSin_B1_Space` | Polygon | `id`, `category`, `floor_id`, `name`, `restricted`, `suite`, `nonpublic`, `toll`, `source` | Preserved in `properties`; `floor_id` is normalized for coordinate elevation and stable ID. |
| `JrSin_B1_Opening` | PolyLine | `id`, `floor_id`, `name`, `source` | Preserved in `properties`; coordinates converted to local metres. |
| `JrSin_B1_Facility` | Point | `id`, `category`, `floor_id`, `name`, `source` | Preserved in `properties`; coordinates converted to local metres. |
| `JrSin_B1_Fixture` | Source-dependent | layer is imported when present | Preserved when present; absent layers are skipped without creating empty browser assets. |
| `JrSin_B1_TWSI_Line` | PolyLine | `id`, `startnode`, `endnode`, `category`, `roof`, `floor_id`, `source` | Preserved in `properties`; tactile paving geometry is imported for visual/debug use only. |
| `JrSin_B1_TWSI_Point` | Point | `id`, `floor_id`, `category`, `name`, `lat`, `lon`, `source` | Preserved in `properties`; shapefile point coordinates are authoritative for geometry. |

## Determinism and provenance

Generated timestamps are fixed, features are sorted by processed ID, properties are sorted by key, and input shapefile/DBF checksums are recorded. Re-running `npm run data:convert` with identical inputs should produce byte-identical JSON.

## Official-network model

The processed schema now includes the bounded official `nw/Shinjuku_node` and `nw/Shinjuku_link` pedestrian network. The canonical TypeScript definitions and runtime parsers live in `src/schema/processed.ts` and are shared by scripts and browser code.

The importer follows these rules:

- Preserve `node_id`, `link_id`, `start_id`, and `end_id` as source identifiers/references.
- Preserve raw coded values alongside any normalized interpretation.
- Decode `ordinal`, `in_out`, `rt_struct`, `route_type`, `direction`, `width`, `vtcl_slope`, `lev_diff`, `brail_tile`, `elevator`, and `roof` according to MLIT's 2018 walking-space network specification, while preserving every raw value.
- Preserve source `distance` as metres. The runtime graph uses it when positive and falls back to converted geometry distance when it is zero, so spatial movement never has zero routing cost.
- Derive wheelchair accessibility conservatively from the confirmed movement type, width, slope, level-difference, and elevator-equipment definitions. Stairs, escalators, width under 1 m, slope over 5%, level difference over 2 cm, and elevators explicitly lacking wheelchair equipment are inaccessible. Tactile paving is retained as source evidence but does not determine wheelchair accessibility.
- Code `99` remains `unknown`. The Accessible profile permits an otherwise viable unknown edge but reports the affected fields in the route warning; it never treats unknown as confirmed accessible. Known-inaccessible edges are always excluded. This policy preserves route availability in the incomplete source while making the uncertainty visible.
- Preference profiles operate only on a runtime cost/filter view. They never add, remove, snap, or mutate official nodes, links, directions, place attachments, source distances, or geometry.
- Keep the general pedestrian network and TWSI network as distinct layers.
- Attach named places to network nodes through a deterministic rule that records attachment distance and confidence.

`reports/map-semantics-profile.json`, generated by `npm run data:profile`, is the machine-readable evidence for current value distributions and missing-name coverage.

### Bounded official-network slice schema

`npm run data:network` writes `public/data/processed/jr-shinjuku-ticket-gates-b1-official-network.json` with:

- `selection`: the facility, normalized floor, source ordinal, source bounds, and exact inclusion rule.
- `selection.coverage`: `bounded-extraction`, requiring route failures across selected components to be reported as outside coverage.
- `nodes`: stable source ID, source record, normalized floor, ordinal, normalized facility interior/boundary/exterior state, local-metre coordinate, and all raw properties.
- `edges`: stable source ID, source record, endpoint IDs, source distance in metres, converted-geometry distance, difference between those distances, normalized direction and movement kind, local-metre geometry, and all raw properties.
- `statistics`: source/selected counts, excluded boundary links, components, isolated nodes, movement/direction counts, and maximum distance disagreement.

The current slice is an induced graph selected by B1 Floor-layer bounds and `ordinal = -1`. Links crossing that boundary are excluded and counted. This is deterministic but is not a claim that the rectangular selection exactly represents facility ownership.

### Named-place attachment schema

`npm run data:places` writes `public/data/processed/shinjuku-b1-named-places.json`. Each place contains:

- Stable place and source feature IDs.
- Source layer and original category code. Facility destinations retain their stable processed-feature identity and full-map provenance.
- Source facility, file, and record number.
- Source Japanese name and normalized category.
- Normalized floor and local-metre coordinates.
- Attached official node ID, distance in metres, confidence, and connected-component ID.
- An explicit two-point access geometry, attachment review state, and `routable` decision.

Confidence is `high` at no more than `5 m`, `medium` above `5 m` through `15 m`, and `low` above `15 m`. High and medium automatic attachments are currently routable; low-confidence attachments remain visible in debug mode but are excluded from normal route choices until reviewed.

Japanese source names remain authoritative. For unnamed reviewed Facility records, the authoritative Japanese category name from specification table 8.3.1 is used, with a deterministic within-area/floor/category ordinal only when needed to distinguish repeats. The corresponding authoritative English category name is stored as a search alias; no free-form translation is invented. Search presentation groups places by floor, source area, and category. The initial empty-query view is capped at 100 results, while typed queries search the complete routable catalog.

### Place-translation overlay

`npm run data:translations` reads the human-reviewable `data/place-translations.source.json` and writes:

- `public/data/processed/shinjuku-place-translations.json` for runtime presentation and search.
- `reports/place-translation-coverage.json` for review and release evidence.

The versioned runtime artifact contains one record for every routable stable place ID and every exact public source-area identifier. Each record preserves Japanese text, optional reviewed English text, language-specific aliases, provenance, and one explicit status:

- `specification`: English comes from the official indoor-map category definition.
- `reviewed`: English was reviewed for this application.
- `pending`: English is unavailable and public English-mode display deliberately falls back to Japanese.

The generator validates IDs against the current named-place dataset, rejects duplicate records and unsupported locale fields, requires reviewed/specification English values, and prevents Japanese place text from drifting from the source. A reviewed area record may remove only its numeric source prefix and replace the source separator `_` with `・`; the exact source-area ID remains unchanged for identity, provenance, and search.

Runtime resolution is presentation-only. Japanese uses the authoritative or explicitly reviewed Japanese text. English uses reviewed/specification English and then Japanese fallback. Stable place IDs, graph attachments, route costs, URL state, and raw provenance never depend on translated text. Search indexes Japanese and English names, aliases, categories, and area terms together, applies NFKC normalization, and therefore returns the same stable records independently of the selected display locale.
