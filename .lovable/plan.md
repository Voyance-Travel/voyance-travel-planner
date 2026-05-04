# Fix: "Accommodation 159%" overflow in Budget by Category

## Root cause

`getCategoryAllocations` in `src/services/tripBudgetService.ts` injects an **Accommodation** (and **Flight**) row whenever the user has "Include Hotel/Flight in Budget" toggled on AND a hotel/flight cost exists in `activity_costs`. Its percentage is computed as:

```
hotelPercent = committedHotelCents / budgetTotalCents * 100
```

Spend-style allocation profiles (`value_focused`, `balanced`, `splurge_forward`) only contain food / activities / transit / misc / buffer — there is **no hotel bucket**. So the injected Accommodation row has no allocation to live inside; if the hotel cost exceeds the trip budget total, the % goes above 100 (e.g. $2,850 hotel against a $1,796 trip budget = 159%).

The UI in `BudgetTab.tsx` then renders that row with `allocated = used` and a percent badge, making it look like a category that was "given" 159% of the budget — which is nonsensical because it was never allocated at all.

A secondary symptom: when committed fixed costs exceed the budget, `discretionaryTotal = max(budgetTotal − committedFixed, 0) = 0`, so Food / Activities / Transit / Misc all collapse to `$0 / $0`, which compounds the confusion.

## Fix

Reframe Accommodation and Flight as **Fixed Costs**, visually and semantically distinct from the discretionary allocation buckets, and stop expressing them as a "percent of budget" that can exceed 100%.

### 1. `src/services/tripBudgetService.ts` — `getCategoryAllocations`

- Tag the hotel and flight rows with a new `kind: 'fixed'` field (vs `'discretionary'` for the others).
- Stop computing `percent` for fixed rows — it's not an allocation slice. Instead expose `shareOfBudget` (committed / budgetTotal) for informational display, and a boolean `exceedsBudget` when committed > budgetTotal.
- Keep `allocatedCents = usedCents` for fixed rows but flag them so the UI can render them differently.
- Clamp `discRatio` so discretionary categories still show their intended slider percentages even when fixed costs blow past the total (the buckets just become "$0 remaining" rather than visually disappearing).

Type addition (in the same file):
```ts
export interface CategoryAllocation {
  category: BudgetCategory;
  allocatedCents: number;
  usedCents: number;
  remainingCents: number;
  percent: number;
  kind?: 'fixed' | 'discretionary';
  exceedsBudget?: boolean;
}
```

### 2. `src/components/planner/budget/BudgetTab.tsx`

- Split `allocations` into two groups: `fixed` (hotel, flight) and `discretionary` (food, activities, transit, misc).
- Render a small **Fixed Costs** sub-header above the fixed rows, with a one-line caption: *"Tracked against your trip total but not part of the spend-style allocation."*
- For fixed rows:
  - Drop the `%` allocation badge (it was the source of "159%").
  - Show the dollar amount only, e.g. `$2,850` with a muted "share of total: 159%" note.
  - When `exceedsBudget` is true, show a destructive inline warning under the row: *"Accommodation exceeds your trip budget by {delta}. Consider raising your total or toggling 'Include Hotel in Budget' off."* with a quick action that scrolls to the budget total / toggle.
- Render discretionary rows below with their existing progress bar + percent badge UI.

### 3. Edge case

If `budget_include_hotel` is OFF, the hotel row is already filtered out by existing logic (per the budget-visibility memory). Confirm the same in the new fixed-row path so toggling the switch immediately removes the row.

## Out of scope

- No schema changes.
- No change to spend-style profiles or how discretionary percentages are calculated.
- No change to the Trip Total / payments reconciliation logic fixed earlier.

## Acceptance

- With Splurge-Forward selected and a $2,850 hotel against a $1,796 trip budget, the Budget by Category panel shows:
  - A "Fixed Costs" group with **Accommodation $2,850** (no % badge), an inline destructive warning that it exceeds the trip total, and a "share of total" note.
  - The four discretionary categories (Food, Activities, Transit, Misc) below, with their normal slider percentages and `$0` remaining.
- Toggling **Include Hotel in Budget** OFF immediately removes the Accommodation row and restores the four discretionary buckets to their non-fixed-cost view.
