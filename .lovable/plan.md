
# Universal Activity Locking — Fix Plan

## Summary
The backend pipeline already has extensive locked-activity support (compile-day-facts loads them, compile-prompt injects them, repair-day skips them, enrich-day skips them, persist-day saves them). However, there are critical gaps on both the frontend (activities never get marked locked) and backend (locked activities aren't passed through to key post-processing steps).

## Changes

### 1. Frontend: Mark user-created activities as locked
**File: `src/components/itinerary/EditorialItinerary.tsx`**
- `handleAddActivity` (~line 4832): Change `isLocked: false` to `isLocked: true`
- `handleUpdateActivity` (~line 5055): Add `isLocked: true` to the merged update so any user edit locks the activity
- `DiscoverDrawer` `onAddActivity` handler (~line 7284): Ensure activities added from Discover get `isLocked: true`

### 2. Backend: Pass locked activities to repair and quality pass
**File: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`**

The locked activities are already loaded by `compile-day-facts` and available in the facts object, but `repairDay()` and `universalQualityPass()` both receive `lockedActivities: []`. Fix both call sites (~lines 1284 and 1382) to pass the actual locked activities from the compiled facts.

Also: at the top of the post-generation sanitization block (~line 1649 in sanitization.ts), add a locked check so restaurant dedup never removes locked activities.

### 3. Backend: Sanitization locked guard
**File: `supabase/functions/generate-itinerary/sanitization.ts`**
- In the restaurant repeat removal filter (~line 1649): Add `if (act.isLocked || act.locked) return true;` before the repeat check so user-specified restaurants survive dedup.

### 4. Redeploy `generate-itinerary` edge function

### Files changed
- `src/components/itinerary/EditorialItinerary.tsx` (3 small edits)
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (2 lines: pass locked activities)
- `supabase/functions/generate-itinerary/sanitization.ts` (1 line: guard)
