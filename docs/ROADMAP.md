# Roadmap

## Purpose

This file contains only verified remaining improvements. Completed phase plans and historical review findings are intentionally not retained in the public documentation.

Routing correctness, source authority, deterministic generation, and accessibility uncertainty remain non-negotiable constraints for every item.

## Priority 1 — Route-focused map density

The map already limits facility markers by zoom and selected categories, but marker selection is not route-aware.

Potential improvements:

- Give the active route, endpoints, current instruction floor, and next transition the strongest visual priority.
- De-emphasize unrelated markers while a route is active.
- Consider clustering repeated connectors at overview zoom.
- Offer an explicit exploration mode that restores the full selected facility context.

Acceptance:

- Route turns and transitions remain readable in stacked and single-floor views.
- Start, destination, and transition markers are never hidden.
- Exploration does not clear or recalculate the route.

## Priority 1 — Keyboard-efficient facility discovery

Visible map markers have accessible names, but a dense marker collection can still create an inefficient tab sequence.

Potential improvements:

- Implement roving focus within the marker collection.
- Support directional movement where spatial relationships are reliable.
- Provide a searchable non-spatial facility list.
- Synchronize list selection and map focus.

Acceptance:

- Keyboard users can reach primary route controls without traversing every marker.
- Every public marker remains discoverable without pointer input.
- Focus behavior is covered in a real browser.

## Priority 1 — Floor-control clarity

Keep visible floors, focused floor, route-used floors, and isolated-floor selection visually distinct.

Acceptance:

- Each selected state has one meaning.
- Route-floor indicators are not confused with selection.
- Public counts use the eight normalized floors rather than source-group variants.

## Priority 2 — JavaScript delivery size

The production build passes its release budget, but Vite reports a chunk above its generic 500 kB advisory threshold. Three.js is the primary large dependency.

Investigate route-safe lazy loading or stable manual chunking without delaying essential planner UI or breaking container caching.

Acceptance:

- Initial interaction remains responsive.
- The viewer loads reliably on direct and fallback routes.
- Release verification and browser tests remain green.

## Priority 2 — Translation review

Forty-seven technical elevator/escalator identifiers intentionally remain Japanese fallbacks. Promote a record only when an official English name or explicit human-reviewed translation is available.

Acceptance:

- No generated or inferred runtime translation.
- Every promoted value retains provenance.
- Japanese and cross-language search behavior remains stable.

## Continuous maintenance

- Keep dependencies and production audit results current.
- Recheck desktop/mobile overlay geometry after control changes.
- Keep current documentation synchronized with generated reports.
- Add new roadmap items only with code, browser, test, or data evidence.
