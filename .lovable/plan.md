

## Fix: Hotel Price Inflation and "Include Hotel" Toggle Not Working

### Root Causes Found

**Bug 1 — The $2,375 → $12,365 mystery**: This is NOT the hotel price changing. The `v_trip_total` view sums `total_cost_usd` (a generated column: `cost_per_person_usd * num_travelers`) across ALL rows in `activity_costs`. When you entered $2,375 for the hotel, it was correctly stored. But $12,365 is the **sum of all trip costs** — your activities (~$9,990) PLUS the hotel ($2,375). The UI labels this as "Trip Expenses" but doesn't clearly break down what's hotel vs activities, making it look like the hotel price inflated.

**Bug 2 — "Remove from budget" doesn't remove from total**: The `budget_include_hotel` toggle in Budget Settings only affects the budget allocation math (`getBudgetSummary` lines 412-414). But the **Trip Expenses card** and **Budget Remaining card** both use `snapshot.tripTotalCents` from the `v_trip_total` view, which **always includes hotel and flight rows** regardless of the toggle. So turning off "Include Hotel in Budget" changes nothing visible.

**Bug 3 — Deleting hotel from ledger list doesn't update snapshot**: When you delete the hotel entry via the trash icon in the "All Costs" list, it calls `deleteLedgerEntry` which removes the `activity_costs` row. But the financial snapshot doesn't immediately refetch — and the itinerary header still computes `hotelCost` from the `hotel_selection` JSON field on the trips table (which is NOT deleted).

### The Fix

**1. Financial Snapshot: Respect `budget_include_hotel` / `budget_include_flight` toggles**

In `useTripFinancialSnapshot.ts`, fetch the trip's `budget_include_hotel` and `budget_include_flight` settings. When computing `tripTotalCents`, subtract hotel/flight `activity_costs` rows (category='hotel'/'flight', day_number=0) when the corresponding toggle is OFF. This makes the "Trip Expenses" card and "Budget Remaining" card respect the user's preference.

Alternatively (and more cleanly): query `activity_costs` directly with category exclusion filters instead of using `v_trip_total`.

**2. BudgetTab: Show Trip Expenses excluding toggled-off categories**

Update the Trip Expenses card in `BudgetTab.tsx` to compute the displayed total by subtracting hotel/flight costs when the user has toggled them off, matching their mental model.

**3. EditorialItinerary header: Same category-aware total**

The itinerary header total at line 2721 should also respect the hotel/flight inclusion settings so the number is consistent everywhere.

**4. Snapshot refetch after ledger deletion**

In `useTripBudget.ts`, the `deleteEntryMutation.onSuccess` already dispatches `booking-changed` — which `useTripFinancialSnapshot` listens to. This should work but we need to verify the event fires correctly. If it does, this is already handled.

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `src/hooks/useTripFinancialSnapshot.ts` | Fetch `budget_include_hotel`/`budget_include_flight` from trips table. Query `activity_costs` directly with category filters instead of `v_trip_total` so excluded categories are omitted from the total. |
| 2 | `src/components/planner/budget/BudgetTab.tsx` | Use the updated snapshot (which now respects toggles) — no formula changes needed if snapshot is correct. |
| 3 | `src/components/itinerary/EditorialItinerary.tsx` | Pass `budget_include_hotel`/`budget_include_flight` context to ensure the header total matches. Or: always show full trip cost in header (since it's informational), and only apply the toggle in the Budget tab. |
| 4 | `src/services/tripBudgetService.ts` | Ensure `getBudgetSummary` uses the same snapshot logic for consistency. |

### Summary

The core issue is a **display-layer disconnect**: the "Include Hotel/Flight in Budget" toggles only affect internal budget allocation math but NOT any visible number. The fix makes all three surfaces (Budget tab cards, itinerary header, payments) consistently exclude hotel/flight costs when the user has toggled them off.

