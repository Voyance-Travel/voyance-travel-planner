## Problem

When generation produces a hotel-only itinerary (or one with only generic "Free time" / $0 placeholder entries), the Budget Coach today still:

- Renders its full shell ("You're $X over budget", overrun chips, restructure / hotel-dominant panels, sometimes cached suggestions).
- Reads as "the system is recommending swaps and drops" even though the underlying suggestion list is `[]`.

The existing safeguards are partial:
- `countMeaningfulActivities` (Stage 6 + save) flips a trip to `failed / empty_itinerary` only when the meaningful count is **exactly 0**. A hotel-only trip with even one generic "Explore the neighborhood" row passes the gate.
- `BudgetCoach` only stops the **AI call** when `suggestableCount === 0`; the surrounding chrome and any in-memory cached suggestions still render.
- `BudgetTab` hides the Coach only when `tripStatus === 'failed' && generationFailureReason === 'empty_itinerary'`. Older trips, manual saves, and hotel-only trips that pass the meaningful-count gate never satisfy that condition.

## Fix (4 small changes)

### 1. Tighten the empty / degenerate detection (server)

`supabase/functions/generate-itinerary/day-validation.ts`

Extend `countMeaningfulActivities` to also return a `paidMeaningfulCount` — meaningful activities with a positive cost, excluding generic placeholder titles (`Breakfast`, `Lunch`, `Dinner`, `Activity`, `Free time`, `Explore the neighborhood`, etc., reusing the same regex `BudgetCoach` uses).

`supabase/functions/generate-itinerary/action-save-itinerary.ts` and `generation-core.ts` (the two Stage 6-style probes)

Treat the trip as a failed generation when **either**:
- `meaningfulCount === 0`, **or**
- `paidMeaningfulCount === 0` and the trip has more than 1 day, **or**
- `paidMeaningfulCount <= 1` and `dayCount >= 2` (clearly degenerate — covers the "hotel + one filler" case).

Use a new failure reason `incomplete_itinerary` (keeping `empty_itinerary` for the strict zero case) so we can surface a slightly different banner copy without losing existing telemetry.

### 2. Hide the entire Budget Coach when there's nothing to coach (client)

`src/components/planner/budget/BudgetTab.tsx`

Compute `hasSuggestableContent` from `itineraryDays` using the same `isSuggestable` rules as `BudgetCoach` (factor that helper out into `src/components/planner/budget/coachUtils.ts` so both sides agree). Render the Coach only when:

```
!isManualMode
&& !isEmptyItineraryFailure
&& tripStatus !== 'failed'             // covers incomplete_itinerary too
&& hasBudget
&& itineraryDays.length > 0
&& hasSuggestableContent               // NEW
&& summary && snapshotStatus !== 'yellow'
```

Extend the existing failed-itinerary banner to also render when `generationFailureReason === 'incomplete_itinerary'`, with copy: "Your itinerary is missing activities — the Budget Coach is paused until it generates a full plan."

### 3. Make Coach itself fail closed (defense in depth)

`src/components/planner/budget/BudgetCoach.tsx`

When `suggestableCount === 0`:
- Early-return a single compact card ("Add activities to get savings advice"), instead of rendering the full header + overrun chips + restructure / hotel-dominant panels + empty list. This eliminates the "phantom recommendations" look even if the BudgetTab gate above is bypassed.
- Drop the `suggestionsCache` entry for this `tripId` (already done in `fetchSuggestions`, but also do it in a `useEffect` on `suggestableCount === 0` so a mid-session itinerary collapse clears stale data immediately).

### 4. Tests

Add `src/components/planner/budget/__tests__/coachUtils.test.ts`:
- Hotel-only day → `hasSuggestableContent === false`.
- Hotel + generic "Free time" day → `hasSuggestableContent === false`.
- Hotel + one priced "Dinner at Le Jules Verne" → `hasSuggestableContent === true`.
- Locked / dismissed activities don't count as suggestable.

Add a unit test for `countMeaningfulActivities` covering the new `paidMeaningfulCount` field and the "hotel + filler" degenerate case.

## What this does NOT change

- AI prompt logic in `budget-coach/index.ts` — its zero-candidate guard already works; the bug is purely in the client surface and the upstream "is this itinerary actually generated" detection.
- The `EditorialItinerary` Coach plumbing — it still receives the same props, just won't render when there's nothing to coach.
- Existing `empty_itinerary` telemetry — we add `incomplete_itinerary` alongside it, we don't replace it.

## Files touched

- `supabase/functions/generate-itinerary/day-validation.ts` (extend return type)
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` (use new field)
- `supabase/functions/generate-itinerary/generation-core.ts` (use new field)
- `src/components/planner/budget/coachUtils.ts` (new — `isSuggestable`, `hasSuggestableContent`)
- `src/components/planner/budget/BudgetCoach.tsx` (use `coachUtils`, early-return on empty, clear cache effect)
- `src/components/planner/budget/BudgetTab.tsx` (gate Coach on `hasSuggestableContent`, extend banner to `incomplete_itinerary`)
- `src/components/planner/budget/__tests__/coachUtils.test.ts` (new)
- `supabase/functions/generate-itinerary/__tests__/day-validation.test.ts` (extend if exists, otherwise add focused test)
