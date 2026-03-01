
# Fix: Paid Trip Shows Locked After Unlock

## The Problem
When a user pays credits to unlock a trip, the generation completes successfully but the trip page shows all days as locked, asking the user to pay again. Credits were already spent and AI generation costs were incurred.

## Root Cause
The `useUnlockTrip` hook (bulk unlock) **never updates `unlocked_day_count`** on the `trips` table after successfully generating all days. This is the field that `get-entitlements` reads to determine which days are accessible. So after unlock, the entitlements system still thinks no days are unlocked.

Additionally, generated day objects may retain stale `metadata.isLocked = true` flags, causing a secondary lock check to trigger even if entitlements would allow access.

## The Fix (3 changes)

### 1. Update `unlocked_day_count` after bulk unlock
**File:** `src/hooks/useUnlockTrip.ts`

After the itinerary save succeeds (around line 253), add a database update to set `unlocked_day_count` to the total number of days:

```text
await supabase
  .from('trips')
  .update({ unlocked_day_count: params.totalDays })
  .eq('id', params.tripId);
```

Also invalidate entitlements queries so the UI immediately reflects the new unlock state.

### 2. Clear `metadata.isLocked` on generated days
**File:** `src/hooks/useUnlockTrip.ts`

Before saving, strip `metadata.isLocked` and `metadata.isPreview` from each generated day so stale lock flags don't persist:

```text
enrichedDays.forEach(day => {
  if (day?.metadata) {
    delete day.metadata.isLocked;
    delete day.metadata.isPreview;
  }
});
```

### 3. Defensive check in the UI gating logic
**File:** `src/components/itinerary/EditorialItinerary.tsx` (around line 4287)

The current code checks `selectedDay.metadata?.isLocked` as a separate gating criterion from entitlements. This should defer to entitlements when available:

```text
// Only trust metadata.isLocked if entitlements haven't loaded yet
const isLockedDay = selectedDay.metadata?.isLocked 
  && !isManualMode 
  && !canViewPremiumContentForDay(entitlements, selectedDay.dayNumber);
```

This ensures that if entitlements say the day is unlocked, metadata flags can't override it.

## Technical Details
- `get-entitlements` edge function reads `unlocked_day_count` from the `trips` table (line 208-213 of the edge function)
- `canViewPremiumContentForDay()` calls `canAccessDaySimple()` which checks `dayNumber <= unlockedDayCount`
- The `useUnlockDay` hook (single day unlock) already increments `unlocked_day_count` correctly -- the bulk unlock hook was missing this step
- No database migration needed; `unlocked_day_count` column already exists
