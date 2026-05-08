# Day 3 missing lunch + 4h dead gap before checkout

## What the user sees

Day 3 (departure day) of a 3-day Venice trip:

```
12:10  Scala Contarini del Bovolo
[ ─── 4h 15m of nothing ─── ]
16:25  Hotel Checkout
~19:00 Departure
```

No farewell lunch, no afternoon activity. Departure is mid-evening, so policy says lunch IS required — yet it never lands.

## Root causes (4 confirmed in code)

1. **Dead-gap fill is hard-disabled on the last day.** `pipeline/fill-dead-gaps.ts:62` returns early when `opts.isLastDay`. Both pre- and post-pass calls in `action-generate-trip-day.ts` honour this. Result: any afternoon hole on departure day survives untouched.

2. **Last-day meal-guard runs with an empty fallback pool.** `action-generate-trip-day.ts:1646` passes `[]` as `fallbackVenues` to `enforceRequiredMealsFinalGuard` for the per-day pass. On the last day this is the *only* call that can save us (cross-day loop runs later but with the same empty pool at line ~2042). When the AI omitted lunch and the upstream pool was exhausted, the guard has nothing to inject and silently no-ops.

3. **`afternoon_departure` policy is correct but unenforced end-to-end.** `meal-policy.ts:175-177` correctly flags `breakfast + lunch` as required when departure ∈ [15:00, 18:00). But there's no save-time "did lunch actually ship?" assertion on departure days, so the missing meal slips past `[MEAL_AUDIT]` (which logs the no-op as compliant since the guard ran without finding anything to do).

4. **No observability for unfilled departure-day windows.** `reportRemainingAfternoonDeadGap` only fires when `fillAfternoonDeadGaps` runs — and it's skipped on last day. So the 4h dead window never shows up in `metadata.quality.unfilled_dead_gap_minutes`.

## Fix — four-layer departure-day defense

### Layer 1 — Enable bounded gap-fill on the last day

`pipeline/fill-dead-gaps.ts`:
- Replace the blanket `if (opts.isLastDay) return …` with a bounded mode that:
  - Keeps the 12:00 lower bound.
  - Sets the upper bound to `min(AFTERNOON_END_MIN, departureTime - buffer, checkoutTime)`.
  - Treats the gap-end neighbour (`checkout` / `airport transfer`) as a logistics anchor (still skip if neighbour is locked).
- Add `latestUsableMins?: number` to `FillDeadGapsOptions` and thread it from both call sites in `action-generate-trip-day.ts` and `action-generate-day.ts` using the existing `savedDepTime24Hoisted` − buffer logic already computed for `_latestMins`.
- Keep the 2-insert cap so we don't over-fill on a tight window.

### Layer 2 — Real fallback pool for the per-day meal-guard

`action-generate-trip-day.ts` around line 1639-1648:
- Replace the hard-coded `[]` with the same `verified_venues` lookup already used in `action-save-itinerary.ts` (`destination` column — fixed in the previous round). Cache the query inside a per-trip-day local so we don't refetch for each day in the loop.
- Same change at the cross-day loop (~line 2042) so subsequent days also get a non-empty pool.

### Layer 3 — Departure-day "lunch must land" assertion

In `action-generate-trip-day.ts` immediately after the per-day meal-guard at line 1670:
- If `_isLastDay && _fmgPolicy.requiredMeals.includes('lunch')` and `detectMealSlots(dayResult.activities)` still lacks `'lunch'`, force-call `proposeGapFiller` (or directly insert from the fallback pool) targeting the 12:30–14:30 slot bounded by the morning activity end and checkout/cutoff. Mark with `metadata.quality.last_day_lunch_forced = true`.
- Emit `[MEAL_AUDIT_LASTDAY] day=N forced_lunch=<venue>` so regressions are greppable.

### Layer 4 — Observability for last-day windows

`pipeline/fill-dead-gaps.ts`:
- Make `reportRemainingAfternoonDeadGap` (or add a sibling `reportRemainingDepartureDayGap`) run for last-day windows too, using the bounded upper limit.
- Persist `metadata.quality.unfilled_departure_day_gap_minutes` and log `[LAST_DAY_GAP] day=N gap=Xm window=HH:MM-HH:MM`.

## Files to edit

- `supabase/functions/generate-itinerary/pipeline/fill-dead-gaps.ts` — bounded last-day mode + last-day reporting.
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — pass `latestUsableMins`, real fallback pool, last-day lunch assertion.
- `supabase/functions/generate-itinerary/action-generate-day.ts` — same `latestUsableMins` thread-through for chain-mode.
- `supabase/functions/generate-itinerary/__tests__/fill-dead-gaps.lastday.test.ts` — new test: last-day with 4h gap between activity and checkout gets filled when window allows.
- `supabase/functions/generate-itinerary/__tests__/last-day-lunch.test.ts` — new test: `afternoon_departure` policy + missing lunch + non-empty pool → lunch injected at correct time.

## Memory

Update `mem://constraints/itinerary/dinner-required-defer-hotel-return` (or add a sibling `mem://constraints/itinerary/last-day-lunch-and-gap`) noting:
- Departure-day dead-gap fill must run with `latestUsableMins = depTime − buffer`.
- `enforceRequiredMealsFinalGuard` must always receive a non-empty fallback pool on the last day, otherwise `afternoon_departure` lunch silently drops.
- New `metadata.quality.unfilled_departure_day_gap_minutes` and `last_day_lunch_forced` fields are the regression sentinels.
