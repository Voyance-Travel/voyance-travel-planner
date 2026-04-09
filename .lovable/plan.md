

# Fix: Ensure User Activities Reliably Reach Generation Pipeline

## Analysis

The data flow is **partially working** through the metadata fallback path:
- `Start.tsx` (chat path) saves `mustDoActivities` and `perDayActivities` to trip metadata ✅
- `compile-prompt.ts` reads from metadata as fallback when params are empty ✅

However, there are reliability gaps worth closing:

1. **`TripPlannerContext.saveTrip()`** (form path, line 288) does NOT include `mustDoActivities`/`perDayActivities` in metadata. The form path relies on `ItineraryPreview.tsx` doing a separate metadata update later — but if the user skips the context form or it fails, the data is lost.

2. **Client-side generation path** (`useItineraryGeneration.ts` line 252) doesn't pass these fields. If metadata read fails or is stale, generation gets nothing.

3. **Server-side chain** (`action-generate-trip-day.ts` line 530) also doesn't pass them to `generate-day`. It relies entirely on `compile-prompt.ts` re-reading metadata from DB — which works but adds an extra DB query and creates a single point of failure.

4. **`TripDetails` interface** in `useItineraryGeneration.ts` (line 106) doesn't include these fields, so callers can't pass them even if they wanted to.

## Changes

### 1. Add fields to `TripPlannerContext.tsx` saveTrip() metadata (line ~288)
Add `mustDoActivities` and `perDayActivities` from `state.basics` to the metadata object. Also add these optional fields to the `TripBasics` interface.

### 2. Extend `TripDetails` interface in `useItineraryGeneration.ts`
Add optional `mustDoActivities` and `perDayActivities` fields.

### 3. Pass fields in client-side generation call (line ~252)
Add `mustDoActivities` and `perDayActivities` from the trip object to the `generate-day` body.

### 4. Pass fields in server generation call (line ~483)
Add both fields to the `generate-trip` body in `startServerGeneration()`.

### 5. Pass fields in server chain body (`action-generate-trip-day.ts` line ~530)
Add `mustDoActivities` and `perDayActivities` from `tripMeta` to the `generate-day` call body, so `compile-prompt.ts` gets them as params (faster, more reliable than re-querying DB).

### 6. Add diagnostic logging
- `TripPlannerContext.tsx` saveTrip(): log presence of mustDo/perDay
- `useItineraryGeneration.ts`: log before generation call
- `action-generate-trip-day.ts`: log what was read from metadata and passed to generate-day

### 7. Redeploy `generate-itinerary` edge function

## Files Changed
- `src/contexts/TripPlannerContext.tsx` — metadata + TripBasics interface
- `src/hooks/useItineraryGeneration.ts` — TripDetails interface + generation bodies
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — pass-through params + logging

