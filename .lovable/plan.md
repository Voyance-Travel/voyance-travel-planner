

# Fix: White Page When Generating an Active-Date Trip

## Root Cause

When navigating to `/trip/${id}?generate=true` from "Just Tell Us", TripDetail checks if the trip falls within the current date window (start_date <= today <= end_date). Since this trip starts today (April 9), the redirect at line 2136 fires **before** the auto-generate useEffect can trigger:

```
if ((isLiveTrip || isInDateWindow) && searchParams.get('edit') !== 'true') {
    return <Navigate to={`/trip/${trip.id}/active`} replace />;
}
```

This sends the user to `/trip/${id}/active` (ActiveTrip page) with no itinerary data — the white page. When they click "Edit" there, they go to `/trip/${id}?edit=true` which loads TripDetail but **without** `?generate=true`, so no auto-generation happens.

## Fix

**File: `src/pages/TripDetail.tsx` (~line 2136)**

Add two additional bypass conditions to the date-window redirect:
1. Skip redirect when `?generate=true` is in the URL (generation needs to trigger first)
2. Skip redirect when the trip has no itinerary data yet (nothing to show on ActiveTrip)

Change the condition from:
```ts
if ((isLiveTrip || isInDateWindow) && searchParams.get('edit') !== 'true') {
```
to:
```ts
if ((isLiveTrip || isInDateWindow) 
    && searchParams.get('edit') !== 'true' 
    && !shouldAutoGenerate 
    && !isServerGenerating
    && hasItineraryData(trip)) {
```

This ensures:
- Trips with `?generate=true` stay on TripDetail to trigger generation
- Trips currently generating stay on TripDetail to show progress
- Trips with no itinerary data don't redirect to an empty ActiveTrip page
- Once generation completes and itinerary data exists, the redirect works normally

**File: `src/pages/ItineraryView.tsx`**

Apply the same fix — skip the active redirect if itinerary_data is empty:
```ts
if ((isActive || inDateWindow) && hasItineraryData) {
    return <Navigate to={`/trip/${id}/active`} replace />;
}
```

## Technical Details

- `shouldAutoGenerate` is already defined as `searchParams.get('generate') === 'true'` (line 113)
- `isServerGenerating` is already computed (line 218)
- `hasItineraryData(trip)` already exists as a helper function (line 887)
- No new state, no schema changes, no edge function changes

