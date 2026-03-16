

# Budget Numbers Are Out of Sync — Root Cause & Fix

## The Problem

The Budget tab shows "Expected Spend: $20" while the Trip Total header shows "$1,003". The Budget tab is wrong.

## Root Cause: `activity_costs` table has only 1 row

The `activity_costs` table for this Tokyo trip has exactly **one** row — a stale entry with a UUID-format `activity_id` (`1673f0ae-...`) that doesn't match any current itinerary activity (which use IDs like `day1-act1-1773633950873`). The sync function `syncActivitiesToCostTable` is supposed to upsert all activities on page load, but it's failing silently — likely because:

1. The upsert of 30+ rows in a single batch fails (possibly a row-level trigger or RLS evaluation error on one row kills the entire batch)
2. The error is swallowed by `.catch(err => console.error(...))` inside a dynamic `import().then()` chain
3. Stale rows from previous generations are never cleaned up

The Budget tab reads from `v_trip_total` (which sums `activity_costs`), so it shows $20 (1 row × $10/person × 2 travelers). The header calculates from the JS-side itinerary data and gets $1,003.

## The Fix — 3 Changes

### Fix 1: Make `syncActivitiesToCostTable` batch-resilient
**File: `src/services/activityCostService.ts`**

- Split large batches into chunks of 20 rows to prevent single-batch failures
- Add individual row error handling — if one row fails, continue with the rest
- After upsert, call `cleanupRemovedActivityCosts` to remove stale rows (like the UUID-format one)

### Fix 2: Add cleanup + error logging to `syncBudgetFromDays`
**File: `src/components/itinerary/EditorialItinerary.tsx`**

- After `syncActivitiesToCostTable` completes, call `cleanupRemovedActivityCosts` with the current activity IDs to remove orphaned rows
- Add proper error logging that includes the row count and trip ID for debugging
- After sync completes, call `financialSnapshot.refetch()` to update the Budget tab immediately
- Await the sync properly instead of fire-and-forget, to ensure the snapshot refetch happens after data is written

### Fix 3: Budget tab fallback when snapshot is stale
**File: `src/components/planner/budget/BudgetTab.tsx`**

- Accept a `jsTotalCostCents` prop from the parent (the JS-calculated total from the itinerary)
- When `snapshot.tripTotalCents` is suspiciously lower than the JS total (e.g., less than 20% of it), use the JS total instead
- This ensures the Budget tab never shows $20 when the real spend is $1,003, even if `activity_costs` sync fails

### Files Changed
- **`src/services/activityCostService.ts`** — Chunk batches, add resilient error handling
- **`src/components/itinerary/EditorialItinerary.tsx`** — Add cleanup call after sync, refetch snapshot, pass JS total to BudgetTab
- **`src/components/planner/budget/BudgetTab.tsx`** — Accept and use JS fallback total when snapshot is clearly stale

