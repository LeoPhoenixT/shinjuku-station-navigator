# Internationalization

## Product policy

The application supports English (`en`) and Japanese (`ja`) for public UI, route grammar, formatted values, place display, and search.

Japanese source values remain authoritative. English display values must come from one of these reviewed sources:

1. An official English name published by the responsible operator or authority
2. An English category name from the MLIT source specification
3. An explicitly human-reviewed project translation when no official pair exists

Technical identifiers with no safe English name remain Japanese fallbacks. The application must not invent translations at runtime.

## Architecture

| Concern | Source of truth |
| --- | --- |
| Supported locales and default | `src/i18n/config.ts` |
| Locale state and persistence | `src/i18n/LocaleProvider.tsx` |
| English UI catalog | `src/i18n/catalogs/en.ts` |
| Japanese UI catalog | `src/i18n/catalogs/ja.ts` |
| Locale-aware formatting | `src/i18n/formatters.ts` |
| Translation authoring data | `data/place-translations.source.json` |
| Translation schema | `src/schema/placeTranslations.ts` |
| Deterministic generator | `scripts/build-place-translations.ts` |
| Runtime translation overlay | `public/data/processed/shinjuku-place-translations.json` |
| Coverage evidence | `reports/place-translation-coverage.json` |

Locale is presentation state, not route identity. Switching language rerenders the existing semantic route and must not change endpoint IDs, URL state, route geometry, routing profile, or calculated path.

## UI translation

- Catalog keys represent semantic messages, not copied English sentences.
- Both catalogs must expose the same keys.
- Route steps are assembled from semantic values so the whole sentence follows the selected grammar.
- Distances, durations, floors, route outcomes, labels, buttons, accessibility text, and ARIA names must use the active locale.
- Source IDs and debugging values may remain authoritative raw values in debug-only views.

When adding UI text:

1. Add a semantic key to the catalog type.
2. Add English and Japanese values together.
3. Use the translation function in the component or domain presenter.
4. Add a test that detects missing keys or hard-coded public text.

## Data translation

`data/place-translations.source.json` is reviewed authoring input. Each record retains status and provenance. The supported statuses are:

- `specification`: English comes from an authoritative source specification.
- `reviewed`: an official published name or a human-reviewed project translation.
- `pending`: Japanese remains the display fallback because no safe English value has been approved.

Run:

```bash
npm run data:translations
```

This deterministically rebuilds the runtime overlay and coverage report. Do not edit either generated JSON file manually.

Current checked coverage:

- 583 routable places covered by the overlay
- 536 places with reviewed or specification-backed English
- 47 technical elevator/escalator identifiers intentionally using authoritative Japanese fallback
- 15 public areas with reviewed English
- 464 facility markers and 40 permanent labels covered

These counts come from `reports/place-translation-coverage.json` and must be updated here only after regeneration and verification.

## Display and search behavior

Japanese mode displays authoritative Japanese names.

English mode displays reviewed/specification English where available and an explicit Japanese fallback otherwise. Missing English must not blank a label or make a destination unsearchable.

The search index includes:

- authoritative Japanese names;
- reviewed English names;
- approved aliases and published romanizations;
- normalized variants used for search only.

Changing locale changes ranking and presentation, not which underlying place record is selected.

## Reviewing a new English name

1. Search the responsible operator, transport authority, or government source.
2. Prefer the exact official spelling and capitalization.
3. Record the direct source URL or specification table.
4. Add useful published aliases only when they improve search.
5. If no authoritative name exists, request explicit human review.
6. Keep the record `pending` rather than guessing.
7. Regenerate translations and inspect the coverage diff.

## Verification

At minimum:

```bash
npm run data:translations
npm test
npm run build
npm run release:verify
```

For UI changes, also verify English and Japanese desktop/mobile flows, live language switching, route and URL stability, bilingual search, fallback labeling, and accessible names.
