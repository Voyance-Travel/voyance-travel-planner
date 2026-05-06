## Bug

Budget Coach can still surface over-budget suggestions on a degenerate trip (hotel + 1 paid filler / "shell day"). Two gates exist and they disagree:

- **`hasSuggestableContent(days)`** in `coachUtils.ts` — true if **any** day has ≥1 paid, non-locked, non-generic, non-logistics activity.
- **`classifyItineraryCompleteness(days)`** in `utils/itineraryCompleteness.ts` — returns `'incomplete'` when a multi-day trip has `paidMeaningfulCount <= 1`.

`BudgetTab.tsx` line 785 mounts `<BudgetCoach>` on `hasSuggestableContent` only. A 2+ day trip with a single $250 dinner passes `hasSuggestableContent` but is `'incomplete'`. Result: over-budget Coach UI renders + AI is called against a near-empty itinerary, producing the "phantom suggestions" pattern the original gate was meant to stop.

`BudgetCoach.tsx` has its own internal `suggestableCount === 0` early return (line 616) for the over-budget branch — this fires only when zero suggestables exist, not when the trip is `'incomplete'`. The under-budget branch (`!isOverBudget`) has no completeness check at all, so the "On target" / "close to budget" cards can render against a hotel-only trip.

## Fix

Introduce a single `isCoachEligible(trip)` entry point in `coachUtils.ts` and use it everywhere the Coach renders or fires AI calls.

### 1. `src/components/planner/budget/coachUtils.ts`

Add:
```ts
import { classifyItineraryCompleteness } from '@/utils/itineraryCompleteness';

export interface CoachEligibilityInput {
  days: CoachDay[] | null | undefined;
  tripStatus?: string | null;
  generationFailureReason?: string | null;
}

export function isCoachEligible(input: CoachEligibilityInput): boolean {
  const { days, tripStatus, generationFailureReason } = input;
  if (tripStatus === 'failed' &&
      (generationFailureReason === 'empty_itinerary' ||
       generationFailureReason === 'incomplete_itinerary')) {
    return false;
  }
  const completeness = classifyItineraryCompleteness(days as any);
  if (completeness.status !== 'ok') return false;
  return hasSuggestableContent(days);
}
```

Both branches (over-budget AND under-budget) bail on the same rule.

### 2. `BudgetTab.tsx`

Replace the line-785 gate:
```ts
!isManualMode && !isEmptyItineraryFailure && tripStatus !== 'failed' && hasBudget &&
itineraryDays && itineraryDays.length > 0 &&
hasSuggestableContent(itineraryDays as any) && summary
```
with:
```ts
!isManualMode && hasBudget && summary &&
isCoachEligible({ days: itineraryDays as any, tripStatus, generationFailureReason })
```

Drop the redundant booleans now folded into `isCoachEligible`.

### 3. `BudgetCoach.tsx`

- Move `isCoachEligible` check to the top of the component (before any branch). When `false`, render the existing compact "Add activities to your itinerary…" card and bail. This kills both:
  - the over-budget suggestion fetch (`fetchSuggestions` is no longer reached on a degenerate trip), and
  - the under-budget "On target" / "close to budget" / "Budget raised" cards leaking on hotel-only trips.
- Delete the now-redundant inline `suggestableCount === 0` early return (line 616) — `isCoachEligible` covers it.
- Inside `fetchSuggestions`, add a belt-and-braces `isCoachEligible(...)` recheck so any future caller can't bypass the gate.

### 4. Regression tests — `coachUtils.test.ts`

New `describe('isCoachEligible')` block:
- hotel-only multi-day trip → `false`
- hotel + single $250 dinner across 3 days (the failure case) → `false` (this is the regression)
- hotel + 2 paid activities across 3 days → `true`
- `tripStatus: 'failed'` + `incomplete_itinerary` → `false` even when activities exist
- single-day trip with 1 paid dinner → `true` (single-day exemption preserved)
- null / empty days → `false`

Combined "empty + over-budget" simulation: pass `days` representing a degenerate trip and assert `isCoachEligible === false` so the upstream gate would never mount the over-budget UI.

## Files

**Edited**
- `src/components/planner/budget/coachUtils.ts` — add `isCoachEligible`
- `src/components/planner/budget/BudgetTab.tsx` — single-gate mount
- `src/components/planner/budget/BudgetCoach.tsx` — early bail + fetch guard
- `src/components/planner/budget/__tests__/coachUtils.test.ts` — new regression cases

No backend / schema changes. Pure presentation-layer unification.