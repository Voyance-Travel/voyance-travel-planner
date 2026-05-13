# Health Engine Meal False-Positive Fix

## Root cause

`TripHealthPanel.tsx` (lines 133–154) detects which meals are present by looking **only for the words "breakfast / brunch / lunch / dinner / supper" in the activity title**. Real venue cards — Pinky's, José Enrique, Santaella, Kasalta, La Casita Blanca, the Mezzanine nightcap — don't contain those words in their titles, so every legitimate dining card registers as "no meal detected." The result: Days 2 and 3 show "missing breakfast, lunch, dinner" even though all three meals are clearly on the page, dragging the score from ~70 to 40.

The data the engine reads is identical to what's rendered (same `parseItineraryDays` output) — there is no backend/frontend drift here. The classifier itself is wrong.

## Fix

Replace the title-only classifier with a **time-window + metadata** classifier that matches what the backend repair pipeline already uses to decide meal slots.

For every activity whose category is `dining | restaurant | food | cafe | breakfast | brunch | lunch | dinner` (or whose `mealSlot` / `metadata.mealSlot` is set):

1. If `mealSlot` (or `metadata.mealSlot`) ∈ {breakfast, brunch, lunch, dinner} → use it directly. Brunch counts as breakfast.
2. Else if title contains the meal word → use it (current behavior).
3. Else fall back to **start-time window**:
   - 05:30–10:29 → breakfast
   - 10:30–11:59 → brunch (counts as breakfast)
   - 12:00–15:29 → lunch
   - 17:30–23:59 + 00:00–02:30 (late nightcap dinner edge) → dinner
   - 15:30–17:29 → snack/cafe (does **not** satisfy any required meal)

Activities tagged `nightcap` / drinks-only (per existing `EXPLICIT_DRINKS_RE` in shared scrub) are excluded from the dinner detection — that rule already exists upstream and we mirror it here so the Mezzanine nightcap doesn't falsely satisfy "dinner" on a day that legitimately needs dinner.

## Scope

Single file, frontend only:

- `src/components/trip/TripHealthPanel.tsx` — replace the meal-detection block (lines 133–155) with the classifier above. Extract a small `classifyMealSlot(activity)` helper at top of file for testability.

No backend changes, no schema changes, no prompt changes, no persisted state changes. The `persistedMeals` source-of-truth read for `requiredMeals` (lines 113–131) stays intact — only the **detected** side is being fixed.

## Out of scope

- Backend MEAL_AUDIT stamping (would help, but is a separate hardening task).
- Score weighting changes.
- Departure-day / arrival-day meal-policy logic (already correct).

## Verification

- Reload the San Juan trip — Days 2 and 3 should clear "missing breakfast/lunch/dinner" warnings; score should rise back into the ~70 band.
- Existing meal-policy tests still pass (they test the policy, not the detector).
- Add a small unit test asserting `classifyMealSlot` returns `lunch` for a dining card with `startTime: '12:30'` and title `José Enrique`, and `dinner` for `startTime: '19:45'` title `Santaella`.

## Technical notes

- Time-parse uses the existing `parseTimeAmPm` helper from `_shared/time-parse.ts` (already mirrored frontend-side in `src/lib/itinerary/dayChronoKey.ts`).
- The classifier returns `null` for non-meal dining (afternoon coffee, snack, drinks-only nightcap), so it never inflates the detected set.
