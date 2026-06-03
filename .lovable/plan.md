# Plan: Plug missing-lunch generation holes (Istanbul Day 2 pattern)

## Goal

When a day has a 3h+ unplanned window in the lunch slot AND no dining card actually lands inside 11:00–15:00, the generator must insert a real lunch — not just emit a `WRAP_GAP_OVER_3H` warning at validation time. Today the meal-guard can be falsely satisfied by an out-of-window dining card, and the afternoon dead-gap filler is category-agnostic, so the lunch slot stays empty.

## Scope

Generator only. No frontend changes, no migrations, no backfill of existing trips. Warning surfacing on the Plan Quality panel stays as-is — this fix prevents the underlying condition.

## Root causes to address

1. **`detectMealSlots` (`supabase/functions/generate-itinerary/day-validation.ts` L161–215)** marks `lunch` satisfied as soon as a dining-category card's title contains "lunch", regardless of `startTime`. A card titled `Lunch at Binbirdirek` starting 15:55 falsely satisfies the lunch requirement, so `enforceRequiredMealsFinalGuard` never injects a real midday meal.

2. **`fillAfternoonDeadGaps` (`pipeline/fill-dead-gaps.ts` L268–273)** is called without `preferCategory: 'dining'` for the afternoon window. When the 200-min Topkapi→Binbirdirek hole is detected, the proposed filler can be any sightseeing card, leaving the lunch slot uncovered.

3. **Ordering:** even after fix #1, the meal-guard runs late in the chain and uses fixed `fallbackTimes.lunch = 12:30`. If 12:30 falls inside the gap (which it usually does), injection succeeds. But it currently doesn't fire because of #1, so we have to fix #1 first.

## Changes

### 1. Tighten lunch (and breakfast/dinner) detection in `detectMealSlots`

`day-validation.ts` — in the `titleHit` branch, require the dining card's `startTime` to fall inside that meal's plausible window before counting it as satisfying that meal:

```
breakfast: 06:00–11:00
lunch:     11:00–15:00
dinner:    17:00–22:00
```

If `startTime` is missing or outside the window, drop the `titleHit` credit and fall through to the existing time-based detection (which already uses the same windows). Log `[detectMealSlots] Rejected out-of-window meal title "<title>" startTime=<t> meal=<m>`.

This is the load-bearing fix: it lets the meal-guard see lunch as missing whenever no dining card lands between 11:00 and 15:00, even when a later "Lunch at X" exists.

### 2. Prefer dining when the afternoon dead-gap spans the lunch window

`pipeline/fill-dead-gaps.ts` `fillAfternoonDeadGaps` — when the detected gap overlaps `[11:00, 15:00)` by ≥60min AND the day still requires lunch (caller threads in `requiredMeals` already available at the call sites in `action-generate-trip-day.ts` / `generation-core.ts`), pass `preferCategory: 'dining'` and add `mealSlot: 'lunch'` to the `proposeGapFiller` call so the AI picks a real restaurant.

Plumb a small optional field on `FillDeadGapsOptions`:

```ts
requiredMeals?: ('breakfast' | 'lunch' | 'dinner')[];
```

No behavior change when callers don't pass it (manual mode, tests).

### 3. Post-fill meal-guard retry stays unchanged

The existing `enforceRequiredMealsFinalGuard` retry path in `action-generate-trip-day.ts` (L2640–2696, `[MEAL_FINAL_AUDIT_RETRY]`) will now correctly see `lunch` missing in the false-positive case and inject a real lunch from `__mealGuardPool`. No new wiring needed — fix #1 is sufficient to unblock it.

## Out of scope

- Reworking how `WRAP_GAP_OVER_3H` is rendered on the Plan Quality panel.
- Healing already-persisted Istanbul trips. Next regen / next save will benefit from #1 because `action-save-itinerary` re-runs `enforceRequiredMealsFinalGuard`.
- Changing meal-guard fallback time windows or departure-day logic.

## Tests

Extend `supabase/functions/_shared/__tests__/validate-itinerary-for-persist.test.ts` and add a new `day-validation.detectMealSlots.test.ts`:

- "Lunch at X" dining card at 15:55 → `detectMealSlots` returns `[]` (lunch not credited).
- Same card at 13:00 → returns `['lunch']`.
- Dining card with no meal keyword in title at 13:00 → still returns `['lunch']` (time-based path preserved).
- New `fill-dead-gaps` test: 12:35→15:55 gap with `requiredMeals:['lunch']` calls `proposeGapFiller` with `preferCategory:'dining'`.

## Telemetry

- New log: `[MEAL_FALSE_POSITIVE] day=N rejected "<title>" at <startTime> reason=out_of_window meal=lunch`.
- Existing `[DEAD_GAP_DECISION]` lines already cover the gap-fill path; add `prefer=dining mealSlot=lunch` to the `decision=request_fill` line when triggered.

## Risk

Low. Both changes narrow false positives:
- #1 only refuses to *credit* a meal from a title hit when the time is out of window — the time-based detector is unchanged, so legitimate in-window meals still satisfy.
- #2 only changes the *preference* hint to the gap-filler when lunch is required and the gap overlaps the lunch window; the existing post-fill meal-guard is the safety net.
