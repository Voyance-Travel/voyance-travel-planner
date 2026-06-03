## Goal
Stop valid trips from being marked `partial` when the AI schedules a user-selected must-do under a variant name, translated name, shortened venue name, or title wrapper.

## What will change

1. **Upgrade `assertMustDoCoverage` matching**
   - Keep the existing safety rules: no description/address matching, no transport/logistics rows, no overlapping injected cards.
   - Add a conservative fuzzy identity layer after exact/alias matching:
     - normalize and canonicalize activity identity fields (`title`, `name`, `venue`, `venue_name`, `location.name`)
     - strip generic wrappers like `Guided Tour of`, `Visit to`, `Morning at`, `Experience`, `Tour`, `Museum`, etc. where safe
     - compare significant tokens with an adaptive threshold
     - allow close edit-distance matches for short venue variants and transliterations
   - Return trace-friendly match reasons internally for warnings/tests, while preserving the public `CoverageResult` shape.

2. **Keep false-positive defenses intact**
   - Do **not** search descriptions or addresses.
   - Do **not** let `Travel to X`, `Walk to X`, hotel returns, airport transfers, or generic neighborhood walks satisfy a venue must-do.
   - Preserve the existing overlap demotion behavior.

3. **Add regression tests for the systematic `partial` badge class**
   - Istanbul/restaurant-style cases where user input and AI title differ but clearly refer to the same venue.
   - Transliteration / local-name cases beyond the hardcoded alias map.
   - Wrapper-title cases like `Dinner reservation at X`, `Guided visit to X`, `X experience`.
   - Negative cases proving fuzzy matching does not accept generic neighborhoods, transit, prose-only mentions, or unrelated similarly themed venues.

4. **Update project memory**
   - Revise the must-do coverage memory from “whole-word identity-field match” to “conservative fuzzy identity-field match”.
   - Document that descriptive phrase filtering is only one guard; the hard gate also requires fuzzy venue identity matching to avoid systematic `partial` status.

## Technical notes
- Primary file: `supabase/functions/_shared/assert-must-do-coverage.ts`.
- Test files: existing `supabase/functions/_shared/__tests__/assert-must-do-coverage*.test.ts` plus a targeted new regression block/file if clearer.
- No frontend badge logic change: `TripDetail.tsx` should continue hiding the badge once generation writes `ready/generated/complete`.
- No migration or existing-trip backfill in this change.