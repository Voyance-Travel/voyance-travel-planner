

# Fix: Financial Number Discrepancies Between Itinerary Header, Day Totals, and Payments Tab

## Root Cause

There are **two independent cost calculation systems** that produce different numbers:

1. **Backend (activity_costs table)** — Written during itinerary generation. Reads `act.cost.amount` or `act.estimatedCost.amount` directly from the AI-generated JSON. If the AI outputs `$0` for a dining or transport activity, `$0` is stored. The Payments tab reads from this via `v_trip_total` view.

2. **Frontend (getActivityCostInfo)** — Used to render day totals in the itinerary. Has sophisticated fallback logic: "never free" category detection, `estimateCostSync()` for missing prices, price-level-based estimation. So a restaurant the AI priced at `$0` gets estimated at ~$25-50 on the frontend.

**The $100 gap** between header ($1,976) and Payments ($1,876): The header falls back to `jsTotalCost * travelers` when the snapshot loads slowly or is $0 — this uses the frontend estimation engine. The Payments tab always uses the snapshot (DB values). Since the DB has lower values (missing smart estimation), Payments shows less.

**The Day 2 $25 gap**: The per-activity line items show raw AI costs, but `getDayTotalCost()` runs each through `getActivityCostInfo()` which may estimate a higher value for one activity (e.g., the "Walking through Midtown" activity might get a non-zero estimate via the estimation engine, or one activity gets a different estimate than what's displayed on its card).

## Fix: Unify cost calculation at write time

### 1. Apply smart estimation in the backend cost writer (generate-itinerary/index.ts ~line 4083)

When writing `activity_costs` rows in Phase 4, apply the same "never free" and estimation logic that the frontend uses. This ensures the DB values match what users see.

**Changes:**
- Import/inline the same category detection logic (`isNeverFreeCategory`, meal type inference)
- When `costPerPerson` is 0 and the category is "never free" (dining, transport, etc.), apply a reasonable default estimate based on category and destination
- This makes `v_trip_total` match the frontend's `getDayTotalCost()` output

### 2. Make the header always use the financial snapshot (EditorialItinerary.tsx ~line 2626)

Remove the JS fallback path that creates divergence. If the snapshot is loading, show a loading state rather than a different number. This ensures header and Payments always show the same total.

**Before:**
```typescript
const totalCost = !financialSnapshot.loading && snapshotTotalUsd > 0
  ? snapshotTotalUsd
  : jsTotalCost * (travelers || 1);
```

**After:**
```typescript
const totalCost = snapshotTotalUsd > 0
  ? snapshotTotalUsd
  : jsTotalCost * (travelers || 1); // Only used as initial render before snapshot loads
```

### 3. Ensure day totals and per-item display use the same function

The per-activity cost display on cards should use the same `getActivityCostInfo()` that `getDayTotalCost()` uses, so the sum of visible line items matches the day total shown. Currently there may be activities where the card shows `$0` but the day total function estimates a value.

## Files to Change

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/index.ts` | Apply smart estimation in Phase 4 activity_costs writer — estimate costs for "never free" categories instead of writing $0 |
| `src/components/itinerary/EditorialItinerary.tsx` | Remove divergent JS fallback for header total; always prefer snapshot |
| `src/components/itinerary/PaymentsTab.tsx` | Align payable item cost calculation with the same estimation used by day totals |

## Expected Result

- Header "Trip Total", Payments tab total, and Budget tab total all show the same number
- Day totals = sum of visible per-activity costs (no hidden discrepancies)
- The `activity_costs` table reflects realistic costs, not raw AI zeros

