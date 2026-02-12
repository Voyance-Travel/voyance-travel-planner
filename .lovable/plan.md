

# Create voyanceFlowController.ts + Fix Bugs 11 & 12

## What This Does

Creates a single source of truth library for all business logic decisions, then refactors 8+ files to import from it instead of having their own copies. Also fixes the two remaining server-side bugs.

## Important Discrepancies Found in Your Draft

Before implementing, I found several places where your proposed library doesn't match the actual codebase. These need to be reconciled:

| Your Draft | Actual Code | Resolution |
|------------|-------------|------------|
| `COSTS.RESTAURANT_REC = 15` | `CREDIT_COSTS.RESTAURANT_REC = 5` (pricing.ts line 17) | Use **5** (matches pricing.ts) |
| `calculateTripCost = days x 60 + multi-city 60` | `tripCostCalculator.ts` uses **complexity multipliers** (1.0x-1.3x), **tiered multi-city fees** (0/60/120/180), and **roundUpTo10** | Keep `tripCostCalculator.ts` as-is -- it's already correct and more sophisticated |
| `FREE_LIMITS` has `flex` tier | Actual code has `free` and `flex` as separate tiers in `TIER_FREE_CAPS` with identical values, plus trip-length scaling for Free/Flex | Keep `TIER_FREE_CAPS` and `FLEX_CAPS_BY_DAYS` from pricing.ts |
| `CREDIT_GRANTS.QUIZ_COMPLETION = 100` | Not found in pricing.ts -- may be handled elsewhere | Omit unless confirmed |
| Missing: `TRANSPORT_MODE_CHANGE`, `HOTEL_SEARCH`, `HOTEL_OPTIMIZATION`, `MYSTERY_GETAWAY`, `MYSTERY_LOGISTICS` | All exist in `CREDIT_COSTS` (pricing.ts) | Include all costs |

## Implementation Plan

### Phase 1: Create the Library

**New file: `src/lib/voyanceFlowController.ts`**

This will be a **thin decision layer** that imports constants from `config/pricing.ts` and `tripCostCalculator.ts` rather than duplicating them:

```typescript
// Re-export constants from their canonical sources
export { CREDIT_COSTS, TIER_FREE_CAPS, FREE_ACTION_CAPS } from '@/config/pricing';
export { BASE_RATE_PER_DAY, calculateTripCredits } from '@/lib/tripCostCalculator';

// NEW: Decision functions only
export const FIRST_TRIP_FREE_DAYS = 2;

export function computeUnlockedDayCount(...)
export function canAccessDay(...)
export function getActionCost(...)
export function hasPaidAccessForTrip(...)
export function formatActionToast(...)
```

Key design decision: **Don't duplicate constants**. The library re-exports from `config/pricing.ts` (which has all the Stripe product IDs, pack details, etc.) and adds only the decision functions that were previously scattered.

### Phase 2: Fix Bug 11 -- save-itinerary Override

**File: `supabase/functions/generate-itinerary/index.ts`**

Remove lines 9273 and 9280-9283:
```typescript
// DELETE:
if (itinerary?.isPreview === false) {
  const dayCount = Array.isArray(itinerary?.days) ? itinerary.days.length : 0;
  updatePayload.unlocked_day_count = dayCount;
}
```

Replace the comment on line 9273 with:
```typescript
// unlocked_day_count is managed by the client (TripDetail.tsx + useUnlockDay.ts).
// Do NOT set it here -- doing so creates a race condition with the client's write.
```

### Phase 3: Fix Bug 12 -- hasPaidAccess Leak

**File: `supabase/functions/get-entitlements/index.ts`**

Change line 240:
```typescript
// FROM:
const hasPaidAccess = hasCompletedPurchase || tripHasSmartFinish || unlockedDays > 0;

// TO:
const hasPaidAccess = tripHasSmartFinish || unlockedDays > 0;
```

### Phase 4: Refactor Consumers

**4a. `src/hooks/useEntitlements.ts` (canViewPremiumContentForDay)**
- Import `canAccessDay` from `voyanceFlowController`
- Replace the inline logic (lines 252-264) with a call to `canAccessDay()`
- Keeps the same function signature for backward compatibility

**4b. `src/pages/TripDetail.tsx` (handleGenerationComplete)**
- Import `computeUnlockedDayCount` from `voyanceFlowController`
- Replace inline `isFirstTrip ? Math.min(2, nonLockedDays.length) : nonLockedDays.length` (line 658) with `computeUnlockedDayCount()`

**4c. `src/hooks/useActionCap.ts`**
- Import `getActionCost` from `voyanceFlowController`
- Replace inline cap lookup with the library function

**4d. `src/hooks/useUnlockDay.ts`**
- Import `CREDIT_COSTS` via `voyanceFlowController` (or keep direct import from pricing.ts -- both work since the library re-exports)

**4e. `src/hooks/useGenerationGate.ts`**
- No logic change needed (already uses `tripCostCalculator` correctly)
- Optionally import `FIRST_TRIP_FREE_DAYS` from the library for the comment clarity

### Phase 5: Deploy Edge Functions

Both modified edge functions will be redeployed:
- `generate-itinerary` (Bug 11 fix)
- `get-entitlements` (Bug 12 fix)

## Files Changed Summary

| File | Change Type | Priority |
|------|-------------|----------|
| `src/lib/voyanceFlowController.ts` | NEW -- central decision library | CRITICAL |
| `supabase/functions/generate-itinerary/index.ts` | Remove `unlocked_day_count` from save-itinerary | CRITICAL |
| `supabase/functions/get-entitlements/index.ts` | Remove `hasCompletedPurchase` from `hasPaidAccess` | HIGH |
| `src/hooks/useEntitlements.ts` | Use `canAccessDay` from library | MEDIUM |
| `src/pages/TripDetail.tsx` | Use `computeUnlockedDayCount` from library | MEDIUM |
| `src/hooks/useActionCap.ts` | Use `getActionCost` from library | MEDIUM |

## What This Fixes

| Scenario | Before | After |
|----------|--------|-------|
| First trip (5 days) | Race condition: client sets 2, server overwrites to 5 | Client sets 2, server doesn't touch it |
| Past purchaser, new trip | `hasCompletedPurchase` grants access to all trips | Per-trip gating: only unlocked trips show content |
| Future bugs | Logic in 8 files, each can diverge | One library, all consumers import |

