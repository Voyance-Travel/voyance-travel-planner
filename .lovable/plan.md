

## Problem: $46 Drift Between Budget and Payments Tabs

### Root Cause

Budget and Payments compute their totals from **different data sources**:

- **Budget tab**: Reads `trip_budget_ledger` → sums to $1,496
- **Payments tab**: Falls back to JavaScript-side cost estimation from raw itinerary activity data → computes ~$1,546

The $46 gap comes from Payments re-estimating costs via `estimateCostSync` for activities with zero cost, producing slightly different numbers than what the budget ledger stored.

### Fix

Make the Payments tab use the **same planned total** as the Budget tab when comparing against the budget limit, rather than computing its own independent estimate.

**File:** `src/components/itinerary/PaymentsTab.tsx`

1. **For the "over budget" calculation and progress bar**: Use the budget ledger's planned total (passed via a new prop or fetched from `trip_budget_summary`) instead of `estimatedTotal` from the JS fallback. This ensures the budget comparison is apples-to-apples.

2. **Specifically**: Fetch `trip_budget_summary.planned_total_cents` for the trip and use that as the cost basis when `budgetLimitCents` is set and the canonical `v_payments_summary` view returns no data. This way both tabs agree on what "total planned spend" means.

3. **Keep the per-item JS estimates for the line-item list** — those are useful for showing individual activity costs even when no `activity_costs` rows exist. But the header total and budget comparison should reference the ledger.

### Changes

| File | Change |
|------|--------|
| `src/components/itinerary/PaymentsTab.tsx` | Fetch `trip_budget_summary` planned total; use it for budget comparison instead of JS-estimated fallback total. When ledger total is available, display it as the estimated total in the header so both tabs show the same number. |

