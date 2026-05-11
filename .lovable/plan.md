## What's actually wrong

Bruges trip data confirms the leak: every dining card in the saved itinerary has a templated description like

> "Lunch at Gruuthuse Hof — a real local spot worth visiting"
> "Dinner at Refter — a real local spot worth visiting"

This string is hardcoded at `supabase/functions/generate-itinerary/day-validation.ts:1109` inside `enforceRequiredMealsFinalGuard` (the meal-guard fallback that injects breakfast/lunch/dinner when the AI didn't deliver). It's >30 chars so it passes `MISSING_DESCRIPTION` and lacks any verb so it fails `RESTAURANT_RECOMMENDATION_RE` — but **the validator and `fillMissingDescriptions` LLM backstop never get a chance to see it**.

### Why the existing description-fill misses these

`fillMissingDescriptions` runs at `action-generate-trip-day.ts:1437` immediately after `repairDay`. The two meal-guard call sites that inject these dining cards run **later** in the pipeline:

- `action-generate-trip-day.ts:1839` — final per-day meal guard
- `action-generate-trip-day.ts:2467` — multi-day loop meal guard
- Parity sites: `action-generate-day.ts` (post-fill meal guard at line 1561), `generation-core.ts:2270`, `action-save-itinerary.ts` (save-time meal guard)

So any meal injected by the guard ships to the user with the template string, which is exactly what the user is seeing on the Bruges cards.

A secondary leak: `day-validation.ts:1127/1143/1155` use `fallback.description || "${label} at ${name}"`. Any fallback-DB venue without a description in `fix-placeholders.ts` produces an even shorter blank-equivalent ("Dinner at X").

## Fix

**Goal:** every dining card carries an actionable insider blurb ("Order the…", "Try the…", "Ask for…"), regardless of which pipeline branch produced it.

### 1. Stop shipping the "real local spot worth visiting" template

`supabase/functions/generate-itinerary/day-validation.ts` lines ~1109/1127/1143/1155: replace the descriptive template fallbacks with an empty string sentinel (`description: ''`) so the description-fill backstop treats them as missing and refills them. Keep the title/venue/address logic untouched. If a fallback-DB entry has a real description (some do), keep it — only the templated "real local spot worth visiting" / "{Label} at {Name}" stubs go.

### 2. Run description-fill **after** meal-guard, not before

Add a second `fillMissingDescriptions` pass immediately after every meal-guard call site that can inject new dining cards:

- `action-generate-trip-day.ts` after the line 1839 guard (single-day path) and after the line 2467 guard (multi-day chain loop)
- `action-generate-day.ts` after the line 1561 guard
- `action-save-itinerary.ts` after its save-time meal guard

Each post-guard pass is gated on `result.alreadyCompliant === false` (only runs when something was actually injected) and reuses the same 8s timeout / single Gemini-flash batched call, so it adds ≤1 LLM round trip per day in the rare path. On failure the description stays empty (per the existing Density Protocol — no generic placeholder).

### 3. One-shot legacy backfill for the affected trips

The Bruges trip and any others already saved with the templated string will not regenerate. Add a tiny client-side detector in the existing `useTripFinancialSnapshot` /  `EditorialItinerary` hydration path that, on load of a `ready` trip, checks dining cards for the regex `/— a real local spot worth visiting$/` and silently fires `refresh-day` for each affected day exactly once per trip session (idempotent flag on the trip metadata: `quality.dining_blurb_backfill_v1 = true`). No new edge function. No structural change. Locked / userEdited / pinned / extracted rows are skipped per the Universal Locking Protocol.

### 4. Verification

- Bruges trip (`e0655f06-…`): hard refresh → backfill fires once → all dining cards now show a verb-led blurb ≥30 chars, no "real local spot worth visiting" string remains in `itinerary_data`.
- New generation: trigger a multi-day plan that intentionally omits a dinner from the model output, confirm the meal-guard injects, the post-guard `fillMissingDescriptions` runs (`[DESC_FILL] day=N flagged=K filled=K`), and the saved card description starts with Order/Try/Ask/Don't miss/Request/Sit at/Sample/Specialty.
- Parity tests: extend `description-coverage.test.ts` with a fixture day where every dining card was inserted by `enforceRequiredMealsFinalGuard`; assert the output passes `RESTAURANT_RECOMMENDATION_RE` for all of them.
- Health panel: no new MISSING_DESCRIPTION / RESTAURANT_MISSING_RECOMMENDATION warnings on the test trips.

## Out of scope

- Activity card descriptions (already correct per user)
- Currency / cost / budget snapshot logic
- Chain restaurant / cross-city / wellness placeholder filters
- Front-end card layout, link rendering, neighborhood label
- DB schema changes
- Removing or relaxing the strict `RESTAURANT_RECOMMENDATION_RE` regex

## Memory updates after merge

Update `mem://constraints/itinerary/description-coverage` with the new rule: **description-fill must run after every meal-guard injection point, not just after `repairDay`.** Add a sentinel guidance line referencing the post-guard `[DESC_FILL]` log lines so future regressions are caught in `edge_function_logs`.
