

## Fix: Expected Spend showing $0

### Root Cause

`useTripFinancialSnapshot` fetches activity totals from the `v_trip_total` database view, which reads from the `activity_costs` table. That table is **mostly empty** — only 1 trip has any rows, all showing $0. The real cost data lives in `trip_budget_ledger`, aggregated by the `trip_budget_summary` view (which correctly shows $3,457.64 for the Marrakech trip, for example).

### Fix

**File: `src/hooks/useTripFinancialSnapshot.ts`**

Replace the `v_trip_total` query with a `trip_budget_summary` query:

- Fetch `planned_total_cents` + `total_committed_cents` from `trip_budget_summary` instead of `total_all_travelers_usd` from `v_trip_total`
- Set `activityTotalCents = (planned_total_cents || 0) + (total_committed_cents || 0)`
- This already includes activities, transport, food synced to the ledger
- **Keep** the hotel/flight JSON fallback for cases where ledger sync hasn't run yet, but avoid double-counting by checking if `committed_hotel_cents` and `committed_flight_cents` are already in the ledger totals

Specifically:
1. Query `trip_budget_summary` for `planned_total_cents`, `total_committed_cents`, `committed_hotel_cents`, `committed_flight_cents`
2. `ledgerTotalCents = planned_total_cents + total_committed_cents` (this includes hotel/flight if synced)
3. Only add hotel/flight from JSON if they're **not** already in the ledger (`committed_hotel_cents == 0` and `committed_flight_cents == 0`)
4. `tripTotalCents = ledgerTotalCents + (unaccounted hotel) + (unaccounted flight)`

This is a single-file fix that uses the same data source PaymentsTab and BudgetTab already rely on.

