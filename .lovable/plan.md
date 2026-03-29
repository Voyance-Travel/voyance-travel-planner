

# Fix: Null Guard `.toLowerCase()` Crashes

## Root Cause

Several helper functions accept `string` parameters but receive `undefined` at runtime when activities from the backend are missing `title`, `category`, or `type`. Calling `.toLowerCase()` on `undefined` crashes the render loop, triggering the ErrorBoundary repeatedly.

## Files to Fix

### 1. `src/utils/plannerUtils.ts` (lines 50, 75)
- `getActivityIconName(type)` — add `(type || 'activity').toLowerCase()`
- `getActivityColor(category)` — add `(category || 'activity').toLowerCase()`

### 2. `src/components/booking/InlineBookingActions.tsx` (lines 119, 124, 141)
Three internal functions take `title: string` but receive undefined from callers:
- `isDiningActivity(title)` — guard with `const lowerTitle = (title || '').toLowerCase()`
- `isHotelAmenityActivity(title)` — same guard
- `isNonBookableActivity(title)` — same guard

This is the most likely crash site: `InlineBookingActions` is rendered for every activity in the itinerary, and line 225 passes `activity.title` directly which can be undefined.

### 3. `src/pages/DestinationDetail.tsx` (line 202)
- `act.title.toLowerCase()` — change to `(act.title || '').toLowerCase()`

### 4. `src/components/itinerary/EditorialItinerary.tsx`
- Line 10716: change `title: activity.title` to `title: activity.title || ''` when passing to `InlineBookingActions`
- Line 992-994 (`isNeverFreeCategory`): guard both params with `(category || '').toLowerCase()` and `(title || '').toLowerCase()`
- Line 1020-1022 (`inferCostBasis`): same guards

### 5. `src/services/flightItineraryPatch.ts` (lines 62, 67)
- `isArrivalActivity(title)` and `isDepartureActivity(title)` — guard with `(title || '').toLowerCase()`

## Approach

Add defensive null guards at the function level (not at every call site). This is the fastest, safest fix — all changes are `(param || '').toLowerCase()` or `(param || 'default').toLowerCase()`. No behavioral change for valid data.

## Risk

**Minimal.** These are pure null-coalescing guards. Activities with undefined titles will fall through to default/fallback paths instead of crashing.

