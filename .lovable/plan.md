# Fix: Category breakdowns show $0 with no warning on empty itinerary

## Problem

`BudgetTab`'s "Budget by Category" card is rendered unconditionally. When the itinerary has no meaningful activities (empty or hotel-only), every discretionary row (Food / Activities / Transit) shows `$0 / $allocated` with empty bars — visually indistinguishable from a healthy, untouched budget.

The existing empty-itinerary banner (lines 567–588) only fires when `tripStatus === 'failed'` AND `generationFailureReason` is `empty_itinerary` / `incomplete_itinerary`. A trip whose status was never marked failed (e.g. saved mid-flow, manual paste with no activities, generator that completed without flagging) falls through and renders the misleading bars.

## Goal

When the itinerary has no meaningful (non-hotel/non-logistics) activities, the Category Breakdown must say so explicitly instead of rendering deceptive empty progress bars — regardless of `tripStatus`.

## Changes

### 1. `src/components/planner/budget/BudgetTab.tsx`
- Import `classifyItineraryCompleteness` from `@/utils/itineraryCompleteness`.
- Compute `const completeness = classifyItineraryCompleteness(itineraryDays);` near the existing `isEmptyItineraryFailure` block (~line 553).
- Define `const hasNoMeaningfulActivities = completeness.status === 'empty' || completeness.status === 'incomplete';` — covers the user's case even when status isn't `'failed'`.
- In the Category Breakdown `<Card>` (line 977+):
  - When `hasNoMeaningfulActivities && !isEmptyItineraryFailure` (the failure banner already covers the failed case), **replace the discretionary rows** with an inline empty-state block:
    > "No spending to track yet — your itinerary doesn't include restaurants, activities, or transit yet. [Regenerate / Add activities] to populate this breakdown."
  - Keep the **Fixed Costs** rows (hotel/flight) visible since those are real costs even on an empty itinerary.
  - The empty-state CTA reuses `onRegenerate` if available; otherwise omit the button.

### 2. Discretionary-only guard
- Inside the `discretionaryRows.map(...)` loop, short-circuit it when `hasNoMeaningfulActivities` so we never render `$0 / $X` bars even briefly.

### 3. No backend / data changes
- We do not change `allocations`, `useTripFinancialSnapshot`, or any cost computation. Just gating the UI to surface reality.

## Out of scope
- Auto-marking trips as `failed` on the backend (separate concern).
- Changing the empty-state copy in the existing failure banner.
- Touching the BudgetSummaryPanel header card.
