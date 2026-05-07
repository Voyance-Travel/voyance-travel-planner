## Problem

"Walk to Lunch in San Polo" appears as a $20 line in the Budget tab's **All Costs** view, even though:
- The activity's stored cost is `{amount: 0, currency: USD}`.
- It's correctly absent from the `activity_costs` ledger table.
- The shared `isWalkingLeg` guard already exists and skips it everywhere else (Payments, canonical resolver, generation pipeline, repair-costs).

The value is being synthesized client-side by a Budget-only ledger builder that estimates a price for `category: transport` without consulting `isWalkingLeg`.

## Root cause

In `src/components/planner/budget/BudgetTab.tsx`, the `ledger` array (used for the All Costs list and for the "hidden free count" badge — line 454) is constructed independently from `usePayableItems`. That builder runs `estimateCostSync` on every itinerary activity and bypasses the `isWalkingLeg` predicate that the unified `usePayableItems` path uses (line 505 in `src/hooks/usePayableItems.ts`).

Because the activity's category is `transport`, the estimator returns a default taxi/transit price (~$20) and that line ships into the All Costs view.

## Plan

### 1. Fix the leak

In `BudgetTab.tsx`, locate the `ledger` builder (the loop that consumes `itineraryDays`/`days` and pushes per-activity rows). Add the same guards already used in `usePayableItems`:

```ts
import { isWalkingLeg, isPlaceholderDepartureTransfer, isUnconfirmedIntraCityTaxi, isLikelyFreePublicVenue } from '@/lib/cost-estimation';
…
if (isWalkingLeg({
  title: a.title || a.name,
  description: a.description,
  bookingRequired: a.bookingRequired,
})) continue;
```

Place the check before any call to `estimateCostSync` so walking legs never receive a synthesized cost.

### 2. Centralize so this can't regress

The repeated guard sequence (`isLikelyFreePublicVenue` → `isPlaceholderDepartureTransfer` → `isUnconfirmedIntraCityTaxi` → `isWalkingLeg`) now appears in at least three places: `usePayableItems`, `EditorialItinerary.syncBudgetFromDays`, and (after the fix) the BudgetTab ledger builder.

Extract a single helper `shouldSnapshotZeroCost(activity)` in `src/lib/cost-estimation.ts` that returns `true` when any of those rules fire. Refactor the three call sites to use it. This collapses the surface area so a future "all costs" view can't reintroduce the walking-cost bug.

### 3. Regression test

Add a unit test for `usePayableItems` (or a new `BudgetTab.ledger.test.ts`) that feeds an activity matching `{title: "Walk to Lunch in San Polo", category: "transport", cost: {amount: 0}}` and asserts the resulting list contains zero rows for that id.

### 4. Memory

The Core memory rule **Walking Is Free** already covers this. Update its "Enforced via" footer to mention the new shared `shouldSnapshotZeroCost` helper and the BudgetTab ledger path so future work treats it as a closed surface.

## Files

- edit: `src/components/planner/budget/BudgetTab.tsx` — add guard inside the ledger builder
- edit: `src/lib/cost-estimation.ts` — add `shouldSnapshotZeroCost`
- edit: `src/hooks/usePayableItems.ts` — replace inline guard chain with helper
- edit: `src/components/itinerary/EditorialItinerary.tsx` — replace inline guard chain in `syncBudgetFromDays`
- new test covering the walk-leg case
- update mem://index.md Core "Walking Is Free" line

## Out of scope

No backend or migration changes — `activity_costs` is already clean for this trip; the row is not in the DB. Pure client-side fix.
