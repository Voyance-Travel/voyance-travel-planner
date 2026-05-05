# Fix: "Spending Money & Tips" always $0

## The bug

`misc` (Spending Money & Tips) is sliced out of the budget (e.g. $90) but `usedCents` is permanently $0 because:

1. The itinerary generator never writes `category = 'misc'` rows into `activity_costs` — by design, "tips/cash" can't be planned per-activity.
2. `getCategoryAllocations` (`src/services/tripBudgetService.ts:788`) feeds `summary.plannedMiscCents` into `usedCents`, which is always 0.
3. The "trip total" snapshot (`useTripFinancialSnapshot`) only sums `activity_costs`, so the misc reserve is **not** counted against the budget either.

Result: the user sees `$0 / $90` with a 0% bar, AND has $90 of phantom headroom in the headline budget math. The current "0 logged · Add expense" pill (BudgetTab line 1042) only treats the symptom — the bar still reads as unused budget.

## Fix

Treat the misc allocation as a **committed cash reserve** for cost/headroom math, while keeping it manually loggable.

### 1. Count the reserve in trip totals

`src/hooks/useTripFinancialSnapshot.ts`
- After summing `activity_costs`, add `miscReserveCents` (read from `trip_budget_settings.budget_allocations.misc_percent` × discretionary base, mirroring `getCategoryAllocations`'s `allocBase` logic) into `totalCents`.
- Subtract any **logged** misc expenses already in `activity_costs` (don't double-count once the user logs real cash spend, the reserve shrinks to `max(reserve - logged, 0)`).

`src/services/tripBudgetService.ts` (`getBudgetSummary`)
- Add `reservedMiscCents` to the `BudgetSummary` shape.
- Include it in `totalUsed` / `usedPercent` so warning banners and the snapshot agree.

Extract the reserve-vs-logged math into a small helper (`computeMiscReserve(settings, summary)`) so the snapshot hook, the summary, and `getCategoryAllocations` all use one source.

### 2. Honest UI for the misc row

`src/components/planner/budget/BudgetTab.tsx` (lines 1003–1075)
- Replace the "0 logged" pill with a row that always renders the bar as **filled to the reserve amount** with a distinct neutral fill (e.g. striped / muted), labelled `$X reserved · $Y logged`.
- Tooltip: "Cash budget for tips, SIMs, pharmacy, market finds. Counts against your total even before you log it — log real expenses to track what's left."
- Keep the "Add expense" CTA.
- When `logged > 0`: show `logged / reserved` with the standard progress fill, switching to destructive only if `logged > reserved`.

### 3. Optional seeded estimate (low risk, opt-in)

If `cost_reference` has a `category = 'misc'` / `subcategory = 'daily_spending'` row for the trip's destination, surface it as a hint under the row: `"Typical for {city}: ~$X/day per traveler"`. No write — display only. Skip if no row exists.

### 4. Tests

- `src/services/__tests__/tripBudgetService.test.ts` (new or extend): reserve is included in `totalUsed`; logged misc reduces remaining reserve, never double-counts.
- `src/hooks/__tests__/useTripFinancialSnapshot.test.ts`: snapshot total = activity_costs + max(reserve - loggedMisc, 0).
- BudgetTab render test: misc row shows "reserved" treatment when logged=0; standard bar when logged>0.

## Out of scope

- Auto-generating per-day misc activity rows (would conflict with the "itinerary doesn't plan cash" principle and the existing memory rule about generic stub names).
- Changing the slider max or default %.

## Files

- `src/hooks/useTripFinancialSnapshot.ts`
- `src/services/tripBudgetService.ts`
- `src/components/planner/budget/BudgetTab.tsx`
- new: `src/services/budgetReserve.ts` (shared helper)
- tests as above

## Memory update

Add to `mem://features/budget/budget-coach-system` (or new `budget-misc-reserve-policy`): "Misc/Spending allocation is a committed cash reserve — counted in tripTotalCents, displayed as 'reserved' until user-logged expenses exceed it."
