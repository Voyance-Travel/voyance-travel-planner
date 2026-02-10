

# Fix: Unlock Flow — 3 Surgical Changes + 1 Logic Fix

## What's Broken (confirmed by code inspection)

### Bug 1: Overcharging Credits
**File**: `useUnlockTrip.ts`, line 85
Uses `params.totalDays` (5) to calculate cost instead of only the locked days (3). User gets charged 300 credits instead of 180.

### Bug 2: Force-Gate Checks Wrong Field
**File**: `EditorialItinerary.tsx`, lines 2863-2866
Checks `has_completed_purchase` (Stripe purchases only). Credit-based unlocks set `unlocked_day_count` instead, so the gate never opens.

### Bug 2b: `canViewPremiumContentForDay` Has a Logic Hole
**File**: `useEntitlements.ts`, line 263
After unlock, the server correctly returns `can_view_photos: true`. But the client-side function checks `can_view_photos && !is_first_trip`. For first-trip users (who are the primary unlock audience), `is_first_trip` is still `true`, so this check fails. It falls through to line 264 which only allows days 1-2.

### Bug 3: Reload Races Entitlements Refresh
**File**: `TripDetail.tsx`, line 1080
`window.location.reload()` fires before `refreshEntitlements()` completes, loading stale cached data.

## Implementation Plan

### Change 1: Fix credit calculation (`useUnlockTrip.ts`)

Line 85 — derive cost from locked days only:

```
// Before:
const unlockCost = getUnlockCost(params.totalDays);

// After:
const startDay = params.startDay || 1;
const daysToUnlock = params.totalDays - startDay + 1;
const unlockCost = getUnlockCost(daysToUnlock);
```

### Change 2: Fix `canViewPremiumContentForDay` (`useEntitlements.ts`)

Lines 259-265 — when `can_view_photos` is true (server says user has paid access), return true regardless of `is_first_trip`:

```
// Before:
if (entitlements.can_view_photos && !entitlements.is_first_trip) return true;
if (entitlements.is_first_trip && dayNumber <= 2) return true;

// After:
if (entitlements.can_view_photos && entitlements.has_completed_purchase) return true;
if (entitlements.can_view_photos && entitlements.trip_has_smart_finish) return true;
// For first-trip users: check if they've unlocked days (server sets can_view_photos when unlockedDays > 0)
// If can_view_photos is true AND is_first_trip, they must have unlocked — grant full access
if (entitlements.can_view_photos) return true;
if (entitlements.is_first_trip && dayNumber <= 2) return true;
```

Wait — that simplifies to just: if `can_view_photos` is true, return true for all days. The server already computes this correctly (`hasPaidAccess || isFirstTrip`). The day-level restriction for first-trip users should only apply when `can_view_photos` is true solely because of `isFirstTrip` (not because of `hasPaidAccess`).

Correct fix:

```
// After:
if (entitlements.has_completed_purchase) return true;
if (entitlements.trip_has_smart_finish) return true;
// can_view_photos includes unlockedDays > 0 from server
// For first-trip users who haven't unlocked, can_view_photos is true (from isFirstTrip),
// but we still restrict to days 1-2. If they HAVE unlocked, can_view_photos is true
// from hasPaidAccess, not just isFirstTrip.
if (entitlements.is_first_trip) {
  // Check if access comes from hasPaidAccess (not just isFirstTrip)
  // Server sets can_view_photos = hasPaidAccess || isFirstTrip
  // If has_completed_purchase and trip_has_smart_finish are both false,
  // hasPaidAccess = unlockedDays > 0
  const hasUnlockedDays = entitlements.can_view_photos && 
    !entitlements.has_completed_purchase && 
    !entitlements.trip_has_smart_finish;
  // If they have unlocked days, grant full access; otherwise only days 1-2
  if (hasUnlockedDays && !entitlements.is_first_trip) return true;
  // ... this is circular
}
```

The real issue is the client can't distinguish WHY `can_view_photos` is true. The cleanest fix: **add `unlocked_day_count` to the entitlements response** so the client can check it directly. But that requires an edge function change. Simpler alternative: since `can_view_photos` is `hasPaidAccess || isFirstTrip`, and `hasPaidAccess = hasCompletedPurchase || tripHasSmartFinish || unlockedDays > 0`, we can check:

```
const hasPaidAccess = entitlements.has_completed_purchase || 
                      entitlements.trip_has_smart_finish || 
                      (entitlements.can_view_photos && !entitlements.is_first_trip);
```

No — for first-trip users who unlock, `is_first_trip` is still true, so the third clause fails. We need the server to send `unlocked_day_count` directly.

**Revised approach**: Add `unlocked_day_count` to the entitlements response (it's already computed server-side on line 207), then use it client-side.

### Change 2 (revised): Two-part fix

**Part A**: Edge function `get-entitlements/index.ts` — add `unlocked_day_count` to response (it's already computed as `unlockedDays` on line 207, just not included in the response object).

**Part B**: Client `useEntitlements.ts` — add `unlocked_day_count` to the `EntitlementsResponse` type and update `canViewPremiumContentForDay`:

```
// After:
if (entitlements.has_completed_purchase) return true;
if (entitlements.trip_has_smart_finish) return true;
if ((entitlements.unlocked_day_count ?? 0) > 0) return true;
if (entitlements.is_first_trip && dayNumber <= 2) return true;
return false;
```

This is definitive — no ambiguity about why `can_view_photos` is true.

### Change 3: Replace force-gate with canonical check (`EditorialItinerary.tsx`)

Lines 2861-2866 — replace the `hasPurchased` check with the now-fixed `canViewPremiumContentForDay`:

```
// Before:
const hasPurchased = entitlements?.has_completed_purchase || entitlements?.trip_has_smart_finish || false;
const forceShowBanner = !hasPurchased && currentDayNum > 2 && !isManualMode;

// After:
const canViewThisDay = canViewPremiumContentForDay(entitlements, currentDayNum);
const forceShowBanner = !canViewThisDay && !isManualMode;
```

Apply the same pattern to `canViewPremium` prop (line 2912-2919) and `onActivitySwap` (line 2926-2929).

### Change 4: Remove reload race (`TripDetail.tsx`)

Line 1080 — remove `window.location.reload()`:

```
onUnlockComplete={(enrichedItinerary) => {
  refreshEntitlements();
  setTrip(prev => prev ? {
    ...prev,
    itinerary_data: enrichedItinerary,
  } : prev);
  // No reload — React re-renders with updated state + fresh entitlements
}}
```

### Change 5: Clean up debug logs

Remove `[UnlockBanner Debug]` console.logs from `EditorialItinerary.tsx` (lines 2867-2874).

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useUnlockTrip.ts` | Fix credit calc: `daysToUnlock` not `totalDays` |
| `supabase/functions/get-entitlements/index.ts` | Add `unlocked_day_count` to response payload |
| `src/hooks/useEntitlements.ts` | Add `unlocked_day_count` to type; fix `canViewPremiumContentForDay` |
| `src/components/itinerary/EditorialItinerary.tsx` | Replace `hasPurchased` force-gate with `canViewPremiumContentForDay`; remove debug logs |
| `src/pages/TripDetail.tsx` | Remove `window.location.reload()` from unlock callback |

## Expected Result After Fix

```text
User creates 5-day first trip
  |
Days 1-2: Full access (first trip free)
Days 3-5: Locked with "Unlock Remaining 3 Days" CTA
  |
User clicks unlock (180 credits, not 300)
  |
Credits spent --> Days 3-5 enriched --> unlocked_day_count set in DB
  |
refreshEntitlements() --> unlocked_day_count > 0 --> canViewPremiumContentForDay returns true
  |
React re-renders (no reload) --> All 5 days fully accessible
  |
Chat FAB + Find Alternative available on all days
```
