

# Route Optimization Credit Gate

## Summary
Monetize route optimization with a 20-credit base charge (10 for Club members), a per-trip sliding re-optimization discount, and first-trip exemption. This involves changes across pricing config, the flow controller, the optimize-itinerary edge function, the spend-credits edge function, the frontend dialog, and the optimize button UI.

## Changes Overview

### 1. Pricing Config (`src/config/pricing.ts`)
- Change `ROUTE_OPTIMIZATION: 0` to `ROUTE_OPTIMIZATION: 20`
- Add new constants for the re-optimization discount schedule:
  - `ROUTE_OPT_STANDARD_SCHEDULE: [20, 15, 10, 5]` (4th+ stays at 5)
  - `ROUTE_OPT_CLUB_SCHEDULE: [10, 8, 6, 3]` (4th+ stays at 3)

### 2. Flow Controller (`src/lib/voyanceFlowController.ts`)
- Add `ROUTE_OPTIMIZATION` to the `ACTION_MAP` in `useSpendCredits.ts`
- Add a new exported function `getRouteOptimizationCost(optimizeCount, tier)` that returns the correct cost from the schedule based on how many times the trip has been optimized and whether the user is a Club member
- Re-export the new schedule constants

### 3. Spend Credits Edge Function (`supabase/functions/spend-credits/index.ts`)
- Add `route_optimization` to `FIXED_COSTS` with base cost 20
- Add special handling for `route_optimization` action:
  - Query `trip_action_usage` for current `route_optimization` count on the trip
  - Query `user_tiers` for the user's tier to determine standard vs. Club pricing
  - Calculate the sliding cost from the schedule
  - Override `FIXED_COSTS` with the computed discount price
- Increment `trip_action_usage` for `route_optimization` after successful deduction

### 4. Optimize Itinerary Edge Function (`supabase/functions/optimize-itinerary/index.ts`)
- No credit logic here -- credits are spent client-side before invoking this function (consistent with the existing client-side credit gating architecture)

### 5. Frontend: `useSpendCredits.ts` Hook
- Add `ROUTE_OPTIMIZATION: 'route_optimization'` to the `ACTION_MAP`

### 6. Frontend: New Hook `useRouteOptCost.ts`
- Create a small hook that queries `trip_action_usage` for `route_optimization` count on the current trip
- Combines with the user's tier (from entitlements) to call `getRouteOptimizationCost()` and return the current cost
- Used by both the OptimizePreferencesDialog and the header Optimize button

### 7. Frontend: `OptimizePreferencesDialog.tsx`
- Accept new props: `creditCost`, `isFirstTrip`, `userBalance`, `isSpending`
- Update the "Optimize Routes" button text to show credit cost: "Optimize Routes . 20 credits" (with a Coins icon), matching the hotel search pattern
- If `isFirstTrip`, show no credit badge (free)
- If insufficient credits, disable the button and show inline message: "You need X more credits to optimize routes" with a link to the credits/pricing page
- If optimization would drop balance below 50, show a soft warning

### 8. Frontend: `EditorialItinerary.tsx`
- Import `useRouteOptCost` and `useSpendCredits`
- Before calling `handleOptimize`, spend credits via `useSpendCredits.mutateAsync({ action: 'ROUTE_OPTIMIZATION', tripId })`
- If first trip (from entitlements), skip credit spending
- Pass `creditCost`, `isFirstTrip`, `userBalance` to `OptimizePreferencesDialog`
- On the header Optimize button, add a small credit badge showing the cost (or nothing if first trip)
- After successful optimization, invalidate credit queries so balance updates

### 9. Database: `trip_action_usage` Table
- No schema change needed -- the existing table already supports arbitrary `action_type` strings and `usage_count` tracking per user/trip. The `route_optimization` action type will be inserted/incremented by the `spend-credits` edge function.

## Technical Details

### Re-optimization Discount Logic

```text
function getRouteOptimizationCost(optimizeCount: number, tier: UserTier): number {
  const isClub = ['voyager', 'explorer', 'adventurer'].includes(tier);
  const schedule = isClub ? [10, 8, 6, 3] : [20, 15, 10, 5];
  const floor = schedule[schedule.length - 1];
  if (optimizeCount >= schedule.length) return floor;
  return schedule[optimizeCount];
}
```

`optimizeCount` is the number of *completed* optimizations for this trip (0 = first time).

### Credit Flow Sequence

```text
User clicks "Optimize Routes . 20cr"
  -> OptimizePreferencesDialog confirms preferences
  -> EditorialItinerary calls spendCredits({ action: 'ROUTE_OPTIMIZATION', tripId })
  -> spend-credits edge function:
       1. Looks up trip_action_usage for route_optimization count
       2. Looks up user tier
       3. Calculates sliding cost
       4. Deducts via FIFO
       5. Increments trip_action_usage
       6. Returns { success, spent, newBalance }
  -> On success, calls optimize-itinerary edge function
  -> On failure (insufficient credits), OutOfCreditsModal triggers
```

### First-Trip Exemption
- Checked via `entitlements.is_first_trip` (already available from `get-entitlements`)
- When true, skip the `spendCredits` call entirely and invoke `optimize-itinerary` directly
- The button shows no credit badge for first-trip users

### Files Modified
| File | Change |
|------|--------|
| `src/config/pricing.ts` | Update `ROUTE_OPTIMIZATION` cost, add discount schedules |
| `src/lib/voyanceFlowController.ts` | Add `getRouteOptimizationCost()` function |
| `src/hooks/useSpendCredits.ts` | Add `ROUTE_OPTIMIZATION` to ACTION_MAP |
| `src/hooks/useRouteOptCost.ts` | **New file** -- hook for per-trip optimization cost |
| `src/components/itinerary/OptimizePreferencesDialog.tsx` | Add credit display, insufficient-credits state |
| `src/components/itinerary/EditorialItinerary.tsx` | Integrate credit spending before optimization |
| `supabase/functions/spend-credits/index.ts` | Add `route_optimization` with sliding discount logic |

