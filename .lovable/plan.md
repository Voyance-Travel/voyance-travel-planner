

# Fix: Paid Trip Shows Locked on Day 1 After Generation

## The Problem
After a paid generation completes (e.g., via "Just Tell Us"), the user lands on Day 1 and sees a "locked" prompt asking them to pay again. Navigating to Day 2 and back to Day 1 resolves it. This is a race condition -- not a data bug.

## Root Cause
When generation completes, `handleGenerationComplete` in `TripDetail.tsx` saves `unlocked_day_count` to the database but **never invalidates the entitlements query cache**. The `EditorialItinerary` component renders immediately with stale entitlements (where `unlocked_day_count` is still 0), so `canViewPremiumContentForDay()` returns `false` for all days, showing the LockedDayCard.

By the time the user navigates to Day 2, the background refetch has completed, and the entitlements reflect the correct unlock count.

## The Fix (3 targeted changes)

### 1. Invalidate entitlements after generation save (PRIMARY FIX)
**File:** `src/pages/TripDetail.tsx` (after line 768)

After the force-save succeeds, immediately invalidate the entitlements query so the UI picks up the new `unlocked_day_count`:

```
queryClient.invalidateQueries({ queryKey: ['entitlements'] });
```

This is the main fix. It ensures that the moment `unlocked_day_count` is written, the entitlements cache is refreshed.

### 2. Update `unlocked_day_count` after bulk unlock (EXISTING PLAN)
**File:** `src/hooks/useUnlockTrip.ts` (after itinerary save, around line 253)

The bulk unlock flow (used when unlocking a preview trip via the UnlockBanner) also never updates `unlocked_day_count`. Add:

```
await supabase
  .from('trips')
  .update({ unlocked_day_count: params.totalDays })
  .eq('id', params.tripId);

queryClient.invalidateQueries({ queryKey: ['entitlements'] });
```

Also strip stale `metadata.isLocked` / `metadata.isPreview` from each enriched day before saving.

### 3. Defensive UI gate: entitlements override metadata
**File:** `src/components/itinerary/EditorialItinerary.tsx` (line 4287)

Change the lock check so entitlements take priority over stale metadata flags:

```
// Before (metadata alone can gate):
const isLockedDay = selectedDay.metadata?.isLocked && !isManualMode;

// After (entitlements override metadata):
const isLockedDay = selectedDay.metadata?.isLocked 
  && !isManualMode 
  && !canViewPremiumContentForDay(entitlements, selectedDay.dayNumber);
```

This ensures that even with stale metadata, if entitlements say the day is unlocked, the user sees their content.

## Why This Is Safe
- Change 1 is purely a cache invalidation -- it doesn't alter any data, just forces a fresh fetch
- Change 2 mirrors the pattern already used by `useUnlockDay` (single-day unlock) which correctly updates `unlocked_day_count`
- Change 3 only loosens gating when the server has confirmed access -- it cannot create unauthorized access
- No database migration needed; `unlocked_day_count` column already exists

## Files Modified
- `src/pages/TripDetail.tsx` -- add entitlements invalidation after save
- `src/hooks/useUnlockTrip.ts` -- update `unlocked_day_count` + clear stale metadata + invalidate entitlements
- `src/components/itinerary/EditorialItinerary.tsx` -- defensive entitlements-over-metadata check

