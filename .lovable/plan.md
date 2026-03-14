

## Fix: "Paid so far" should show total expected spend, not just paid payments

### Problem
In the Budget tab, the "Paid so far" card currently only shows amounts from `trip_payments` with `status='paid'`. The user wants this card to show the **current expected spend** — the sum of all itinerary activity costs + transportation + hotel + flight prices.

### What "Expected Spend" means
The total cost of everything in the trip: all itinerary activity prices, transport costs, hotel total, and flight total. This is the same number PaymentsTab already computes as `estimatedTotal` via `payableItems`.

### Changes

**1. Rename "Paid so far" → "Expected Spend" in BudgetTab**

In `src/components/planner/budget/BudgetTab.tsx`, the card at lines 396-428:
- Change label from "Paid so far" to "Expected Spend"
- Show `tripExpensesCents` (the total expected cost) instead of `snapshot.paidCents`
- Update the progress bar and percentage to use `tripExpensesCents` against the budget
- Keep the "Planned but unpaid" helper line but rephrase to "Paid: $X" as a secondary note using `snapshot.paidCents`

**2. Ensure `tripExpensesCents` includes all sources**

Currently `tripExpensesCents` at line 188 is computed as `summary?.totalCommittedCents + summary?.plannedTotalCents` from the budget ledger. This may not include hotel/flight if they haven't been synced to the ledger yet. 

Fix: Also factor in hotel and flight costs directly. BudgetTab already receives `hasHotel` and `hasFlight` props but doesn't receive the actual prices. We need to:
- Fetch hotel/flight prices from the trip record (already done at lines 239-248 for ledger sync) and add them to `tripExpensesCents` if they aren't already represented in the ledger totals.
- Or simpler: pass `tripTotalCents` from the parent that includes all sources (same way PaymentsTab computes it).

The cleanest approach: compute the trip's expected total directly from `trips.hotel_selection`, `trips.flight_selection`, and itinerary activity costs in the snapshot hook, rather than relying on the budget ledger (which may lag behind or exclude categories).

**3. Update `useTripFinancialSnapshot` to fetch trip total independently**

Instead of accepting `tripTotalCents` as a prop (which depends on the parent computing it correctly), the hook should:
- Fetch the trip's `hotel_selection` and `flight_selection` JSON to get hotel/flight prices
- Query `activity_costs` or `trip_budget_summary` for itinerary activity totals
- Sum them to produce `tripTotalCents` internally

**4. Budget Remaining stays as: Budget − Expected Spend**

The "Budget Remaining" card (line 430+) should use `budgetTotalCents - tripExpensesCents` (expected spend), not `budgetTotalCents - paidCents`.

### Files to update

| File | Change |
|------|--------|
| `src/hooks/useTripFinancialSnapshot.ts` | Fetch hotel/flight/activity totals internally instead of accepting `tripTotalCents` prop |
| `src/components/planner/budget/BudgetTab.tsx` | Rename "Paid so far" → "Expected Spend", show `tripTotalCents` from snapshot, update Budget Remaining |

