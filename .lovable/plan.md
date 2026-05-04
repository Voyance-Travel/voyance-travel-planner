# Fix: Hotel "no nightly rate set" warning contradicts the committed line item

## Root cause

`BudgetTab.tsx` lines 488–509 trigger a yellow banner whenever `hotel_selection.totalPrice` and `hotel_selection.pricePerNight` are both missing. The banner copy says *"…has no nightly rate set — we've estimated it from typical … rates."*

That is technically true of the **selection object** but the estimate has already been synced into `activity_costs` as a `committed` row (per the Hotel Ledger Sync mandate — Day 0 hotel cost is always written). So the user sees:

- **All Costs:** *Four Seasons Hotel George V — Hotel · Committed · $2,850* ✅
- **Banner:** *…has no nightly rate set — we've estimated it…* ❌ (reads like the cost is missing)

Both statements are about the same row. The banner is the only wrong one — the $2,850 *is* the estimate.

## Fix

In `src/components/planner/budget/BudgetTab.tsx` (the missing-items warning block):

1. **Rewrite the hotel-missing-rate copy** to acknowledge the estimate is live in the ledger and frame the banner as a precision prompt, not a missing-data alarm:
   > *We've used an estimated nightly rate for **Four Seasons Hotel George V, Paris** (~$2,850 total) based on typical Paris luxury-tier hotels. Add the actual rate in Flights & Hotels to lock in a precise budget.*
2. **Inline the estimated total** by reading `summary.committedHotelCents` (already in scope via the hook) and formatting it with the existing `formatCurrency` helper. If the committed amount is 0 or unavailable, fall back to the prior phrasing without the dollar figure.
3. **No change** to when the banner appears — the underlying detection is correct; only the wording is wrong.

## Acceptance

- Banner no longer claims the rate is unset when a committed estimate exists.
- Banner explicitly references the estimated dollar amount that the user sees in the ledger directly above.
- Banner still appears when the hotel has no real rate, but reads as a "tighten this up" nudge rather than a contradiction.
- No DB or pipeline changes; ledger and totals are unchanged.
