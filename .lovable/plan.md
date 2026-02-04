

# Fix: Hotel Selection Navigation to Itinerary Generation Page

## Problem

After selecting a hotel from the search results, users are being redirected to the deprecated `/planner/summary` page, which then sends them to the old `/planner` page showing "Tell us about your trip." This is the wrong flow - users should go directly to the itinerary generation page.

## Root Cause

The `handleContinue` function in `PlannerHotelEnhanced.tsx` (line 485-509) still navigates to the old booking summary route instead of the itinerary generator.

There are 3 hotel selection paths in `PlannerHotelEnhanced.tsx`:

| Path | Function | Current Destination | Status |
|------|----------|---------------------|--------|
| Select hotel from results | `handleContinue` | `/planner/summary` | BROKEN |
| "I have my own" manual entry | `handleManualHotelSubmit` | `/trip/{id}?generate=true` | Fixed |
| Skip hotel | `handleSkipHotel` | `/trip/{id}?generate=true` | Fixed |

## Solution

Update `handleContinue` to navigate directly to the itinerary generation page (`/trip/${tripId}?generate=true`) instead of `/planner/summary`, matching the behavior of the other two paths.

## Technical Changes

### File: `src/pages/planner/PlannerHotelEnhanced.tsx`

**Before (lines 485-509):**
```typescript
const handleContinue = async () => {
  if (!plannerState.hotel?.id) {
    toast.error('Please select a hotel and room first');
    return;
  }

  let savedTripId: string | null = null;
  try {
    savedTripId = await saveTrip();
  } catch (error) {
    console.error('[PlannerHotel] Failed to save trip:', error);
  }

  const params = getNavigationParams();
  if (savedTripId) {
    params.set('tripId', savedTripId);
  }
  navigate(`/planner/summary?${params.toString()}`);  // ❌ OLD BROKEN ROUTE
};
```

**After:**
```typescript
const handleContinue = async () => {
  if (!plannerState.hotel?.id) {
    toast.error('Please select a hotel and room first');
    return;
  }

  // Save trip and navigate to itinerary generation (same as skip/manual flows)
  const tripId = plannerState.tripId || await saveTrip();
  if (tripId) {
    navigate(`/trip/${tripId}?generate=true`);  // ✅ CORRECT ROUTE
  } else {
    toast.error('Could not save trip. Please try again.');
  }
};
```

## Why This Fix Works

1. **Consistency**: All three hotel paths now navigate to the same destination (`/trip/{id}?generate=true`)
2. **Matches Memory Context**: Aligns with the "unified-start-flow-v3" pattern where the planner flow leads directly to itinerary generation
3. **Follows Stack Overflow Pattern**: Ensures the trip is saved and verified before redirecting

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/planner/PlannerHotelEnhanced.tsx` | Update `handleContinue` to navigate to `/trip/${tripId}?generate=true` |

