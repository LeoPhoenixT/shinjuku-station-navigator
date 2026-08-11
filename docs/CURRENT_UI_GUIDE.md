# Current UI and debug-mode guide

## Purpose

The application is a map-first indoor route planner. Most of the viewport is an interactive 3D representation of Shinjuku Station, with route planning, floor, camera, and direction controls layered over the map.

This document explains the current interface, what debug mode exposes, how the implementation is organized, and where future enhancements can be made.

## Main interface areas

### Route planner

The route planner is implemented in `src/components/ViewerControls.tsx`.

It provides:

- Start and destination search
- Results grouped by floor, source area, and category
- Start/destination swapping
- Route profiles:
  - Shortest
  - Wheelchair accessible
  - Avoid stairs
  - Prefer elevators
  - Fewest floor changes
- Explicit endpoint actions in gate, facility-marker, and permanent place-label popups
- Clear route
- Share route

The searchable catalog contains the original named openings and spaces plus reviewed Facility destinations. Opening an empty search shows the first 100 deterministic results and asks for a name, area, or category when more exist; typing searches the full catalog. The index always includes authoritative Japanese, reviewed/specification English, both alias sets, both category languages, and raw/reviewed area terms, so users can search in either language without changing the interface locale.

When a valid route is calculated, the planner collapses into a compact summary. **Edit route** reopens it.

Possible enhancements include recent or favorite destinations, category icons in search results, floor/operator/category filters, clearer accessibility-confidence indicators, and alternative routes.

### Map toolbar

The map toolbar is implemented in `src/components/MapToolbar.tsx`.

Floor controls include:

- **Stack** to show every floor
- Independent controls for each floor
- A safeguard that keeps at least one floor visible

Camera controls include:

- Fit selected route
- Fit complete station
- Zoom in and out
- North-up view
- Angled 3D view
- Optional free rotation

Map settings include:

- Marker and category visibility
- Building outlines and the walking network
- English/Japanese interface language
- Custom floor visibility
- Free rotation
- Developer diagnostics

### Interface language

The language selector is under **Map settings → Language**. English is the default and the selected language is restored on later visits. It changes application-owned visible text, accessible labels, categories, floor names, feedback, warnings, and complete direction sentences immediately.

Route endpoints, profile, selected step, geometry, and shareable URL remain unchanged during a language switch. Japanese mode uses authoritative or explicitly reviewed Japanese place and area text. English mode uses reviewed/specification English where available and visibly falls back to Japanese for pending records. The committed coverage report lists every pending stable place ID.

Possible enhancements include a floor slider, a **Route floors only** action, a dedicated camera reset, a perspective/orthographic switch, and persistence of map preferences.

### Route directions

The route sheet displays:

- Total distance
- Ordered route instructions
- Floor badges
- Floor transitions
- Accessibility warnings
- Expand/collapse controls

Selecting an instruction highlights its official-network geometry in yellow, reveals its destination floor if necessary, and fits the camera around that step.

Semantic instruction generation is implemented in `src/routing/routeInstructions.ts`. Locale-specific sentence formatting is implemented in `src/i18n/formatters.ts`, and the directions interface is implemented in `src/components/RouteSheet.tsx`.

Possible enhancements include previous/next navigation, journey-progress mode, entrance photographs, landmark-based instructions, and richer transition details.

## Debug mode

Debug mode exposes implementation and source-data layers that normal users generally do not need. It is enabled under **Map settings**. The pedestrian network is now a normal user-facing map toggle and does not require debug mode.

When enabled, it reveals:

- Tactile guidance (TWSI)
- Node IDs

### Official network

The **Pedestrian network** toggle displays the MLIT graph used for consumer routing. It is off by default. Yellow arrows identify one-way links and follow their permitted direction; the current source contains 71 one-way escalator links. Bidirectional links do not show arrows.

Its colors represent source context:

- Blue: inside
- Amber: boundary
- Purple: outside

The classifications come from the official node `in_out` field. They are preserved in `src/graph/buildOfficialGraph.ts` and classified for presentation in `src/map/networkContext.ts`.

This layer is useful for investigating:

- Whether a route follows authoritative links
- Missing connections
- One-way links
- Incorrect floor assignments
- Exterior and boundary transitions
- Alignment between network links and visible polygons

### Tactile guidance

TWSI means tactile walking-surface indicators. This is a separate network derived from tactile-paving data.

It is useful for source-alignment checks, reviewing tactile-guidance coverage, and future visually impaired routing research. It is not used as the general route graph; consumer routing uses the official pedestrian network.

### Node IDs

The node-ID layer displays official graph nodes and shortened source identifiers. It helps developers debug endpoints, links, floor transitions, named-place attachments, and importer problems.

It remains hidden in normal mode because thousands of raw nodes would overwhelm the public interface.

### Debug place behavior

Normal mode exposes routable curated places. Debug mode can also expose low-confidence or otherwise non-routable place records for attachment investigation.

## Map rendering layers

The main scene is implemented in `src/map/MapScene.tsx`.

The approximate rendering order is:

1. Floor slabs
2. Category-colored Space surfaces
3. Fixtures
4. Wall envelopes
5. Floor, space, and fixture outlines
6. Openings
7. Outdoor-source outlines
8. Drawing structural details
9. Debug networks
10. Route geometry
11. Facility and endpoint markers

### Structural geometry

The generated full-map artifact contains:

| Layer | Features |
| --- | ---: |
| Floor | 200 |
| Space | 1,153 |
| Facility | 639 |
| Fixture | 608 |
| Opening | 63 |
| Drawing | 996 |
| TWSI line | 357 |
| TWSI point | 371 |
| **Total** | **4,387** |

Floor and Space polygons create 4 m display-only wall envelopes. Space surfaces use authoritative categories to distinguish circulation, rooms, toilets, vertical movement, restricted areas, outdoor areas, and the quiet unknown fallback. Raised surfaces and perimeter emphasis reinforce vertical-circulation and restricted meanings without relying on color alone. Fixtures use category-specific display dimensions: structural columns and walls are tall solids with strong top outlines, gates are lower barriers, and furniture is subdued context. These presentation values do not affect routing distance or topology.

Opening boundaries use a magenta treatment, while the toggleable Drawing layer uses subdued slate linework because it provides useful structural density but can make the station visually busy. Both use constant-pixel GPU lines with explicit active/context opacity and ordering, so they remain distinguishable across camera angles without competing with routes.

### Outdoor-source geometry

Source floors such as `2out`, `3out`, and `4out` share the display elevation of their corresponding numbered floor. Their outlines remain purple, with reduced opacity on unrelated route-context floors, so exterior-looking source areas remain distinguishable.

This is indoor-map context. The repository does not contain the separate surface-road dataset used by the external reference demo.

### Facility markers

The public viewer evaluates all 639 imported Facility points without publishing them indiscriminately. The deterministic review report records 637 useful-category candidates: 464 pass geometry, floor, label-quality, duplicate, and same-floor network-alignment rules; 173 remain review-only. Code-like source labels such as bare exit numbers and bus-stop codes are not exposed as reviewed public names.

At most 80 source Facility markers appear simultaneously. High-priority facilities appear in overview views, medium-priority facilities appear as the map is enlarged, and dense stairs appear only at closer zoom. Deterministic spatial collision filtering keeps overlapping records from overwhelming the map.

Marker text symbols include:

- `WC`: toilet
- `♿`: multipurpose toilet
- `EL`, `ES`, `ST`, `SL`, `MW`: elevator, escalator, stairs, slope, and moving walkway
- `IN`, `EX`, `GT`: entrance, exit, and ticket gate
- `i`, `TK`, `ATM`, `LK`: information, tickets, ATM, and lockers
- `BUS`, `TX`: bus and taxi stops

Marker buttons expose full category, floor, and source-area labels to assistive technology. Clicking a marker opens a compact detail card rather than changing the active route; reviewed Facility destinations can be selected through route search. Start and destination markers remain visible when Facility markers are disabled.

### Dynamic map legend

The floating **Legend** explains only content applicable to the selected floors and current layer settings. It can include visible Space colors and outline cues, Facility text symbols and priority shapes, Opening and Drawing line treatments, route endpoints, same-floor routes, floor transitions, pedestrian-network contexts and one-way arrows, and debug TWSI geometry.

The legend is expanded initially on desktop and collapsed initially at widths of 640 px or less. It is a keyboard-native disclosure with labeled regions for screen readers. Its panel overlays the canvas within viewport bounds, so expanding it does not resize the map or introduce page scrolling.

## Route rendering

A selected route is rendered twice for complementary purposes:

- GPU wide-line segments position the route within the 3D scene without generating cylinder meshes per segment.
- A projected SVG overlay keeps the orange route continuously visible over complex geometry.

Route colors are:

- Orange: complete route
- Green: floor transition
- Yellow: selected instruction

Rendering is on demand, so the canvas does not continuously redraw while idle. The SVG overlay caches camera and geometry state to avoid unnecessary projection and DOM updates.

Route visibility follows the selected floors in both isolated and partial-stack views. Same-floor route geometry is shown only when its floor is visible. A green transition is shown only when both of its endpoint floors are visible, preventing route lines from floating on hidden levels. The WebGL route and SVG overlay share the same filtered orange geometry.

Relevant modules are:

- `src/map/routeLineGeometry.ts`
- `src/map/RouteScreenOverlay.tsx`
- `src/map/MapScene.tsx`

Remaining route-rendering enhancements include:

- Simplifying duplicate and nearly collinear points
- Simplifying duplicate and nearly collinear route points
- Adding route-direction arrows

## Data and routing flow

The high-level runtime flow is:

```text
Generated JSON
    ↓
Runtime schema validation
    ↓
Official graph + visual map + named places
    ↓
Route planner state
    ↓
A* pathfinding
    ↓
Route instructions and geometry
    ↓
3D map + SVG overlay + directions sheet
```

Important implementation boundaries are:

- React handles interaction and presentation.
- Routing remains independent from React and Three.js.
- Raw shapefiles are not loaded in the browser.
- Browser JSON is generated deterministically and validated at runtime.
- Display heights never change route topology, cost, or distance.

The main viewer orchestration is implemented in `src/components/FloorViewer.tsx`.

## Recommended enhancement priorities

### User experience

1. Add **Route floors only**.
2. Improve instruction navigation and transition presentation.
3. Add destination-category filters.
4. Add meaningful operator and area styling once category semantics are validated.
5. Add route alternatives.
6. Add a mobile step-by-step navigation mode.

### Data and debugging

1. Display edge metadata when a link is selected.
2. Display named-place attachment lines.
3. Visualize disconnected network components.
4. Add filters for stairs, elevators, one-way links, and accessibility uncertainty.
