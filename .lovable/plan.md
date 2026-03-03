

# Server-Side Generation: Never Lose Credits on Page Refresh

## The Problem
Itinerary generation currently runs as a **frontend loop** — the browser calls the edge function once per day, one at a time. If the user refreshes, closes the tab, or navigates away, the loop dies. Credits were already deducted but the itinerary is incomplete, and the user is asked to pay again.

## The Solution
Move the day-by-day orchestration to the **backend edge function**. The frontend makes a single "start generation" call, then polls the trip's status until it's done. Even if the user refreshes or leaves, the server keeps generating and saves the result to the database.

---

## Architecture Change

```text
BEFORE (fragile):
  Browser -> generate day 1 -> save -> generate day 2 -> save -> ... -> done
  (user refreshes) -> loop dies -> credits lost

AFTER (resilient):
  Browser -> "start generation" -> edge function runs ALL days server-side
  Browser -> polls trip.itinerary_status every 3s
  (user refreshes) -> polls again -> sees progress or completed itinerary
```

---

## Implementation Plan

### 1. New Edge Function Action: `generate-trip` (server-side orchestration)

**File: `supabase/functions/generate-itinerary/index.ts`**

Add a new action `generate-trip` that:
- Accepts the same params as the current frontend loop (tripId, destination, dates, etc.)
- Immediately sets `trips.itinerary_status = 'generating'` and returns `{ status: 'generating' }` to the client
- Uses `EdgeRuntime.waitUntil()` to continue running the day-by-day loop in the background
- After each day completes, saves progress to `trips.itinerary_data` (partial itinerary with days so far)
- On completion: sets `itinerary_status = 'ready'`
- On failure: sets `itinerary_status = 'failed'`, triggers credit refund for ungenerated days, stores error in `trips.metadata.generation_error`

The existing `generate-day` action stays untouched (used for single-day regeneration, unlock-day, etc.).

### 2. Frontend: Replace Loop with Single Call + Polling

**File: `src/hooks/useItineraryGeneration.ts`**

Replace `generateItineraryProgressive` (the day-by-day frontend loop) with:
- A single call to `generate-itinerary` with `action: 'generate-trip'`
- Return immediately after the call succeeds

**New file: `src/hooks/useGenerationPoller.ts`**

Create a polling hook that:
- Watches `trips.itinerary_status` for the current trip (query every 3 seconds while status is `generating`)
- Reads `trips.itinerary_data.days` to show progressive day count
- When status becomes `ready`: stops polling, triggers UI update
- When status becomes `failed`: stops polling, shows error with refund confirmation

### 3. Update ItineraryGenerator UI

**File: `src/components/itinerary/ItineraryGenerator.tsx`**

- After credits are deducted and `generate-trip` is called, switch to a "generation in progress" state
- Show progress based on polled data (days completed / total days)
- Display message: "Your itinerary is being generated. You can safely leave this page -- we'll have it ready when you come back."
- Remove the `beforeunload` warning (no longer needed -- generation is server-side)

### 4. Handle Page Reload During Generation

**File: `src/pages/TripDetail.tsx`**

When the trip loads with `itinerary_status === 'generating'`:
- Show a "Generation in progress" banner instead of the empty state or generator CTA
- Start the polling hook automatically
- When polling detects `ready`, refresh the trip data and show the itinerary

When the trip loads with `itinerary_status === 'failed'`:
- Check for `metadata.generation_error` and display it
- Show a "Retry" button (no re-charge -- refund already happened server-side)

### 5. Server-Side Refund on Failure

**File: `supabase/functions/generate-itinerary/index.ts`** (within the new `generate-trip` action)

If the background loop fails partway:
- Calculate ungenerated days
- Call the existing `spend-credits` refund logic server-side
- Save partial progress (days that did complete)
- Set `itinerary_status = 'failed'` with error details

This eliminates the need for any client-side refund logic for initial generation.

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/index.ts` | Add `generate-trip` action with server-side orchestration loop |
| `src/hooks/useGenerationPoller.ts` | **New** -- polling hook for generation status |
| `src/hooks/useItineraryGeneration.ts` | Replace frontend loop with single `generate-trip` call |
| `src/components/itinerary/ItineraryGenerator.tsx` | Switch to poll-based progress UI, remove stall detection |
| `src/pages/TripDetail.tsx` | Handle `generating` and `failed` statuses on page load |

## What Stays the Same
- `generate-day` action (used for single-day unlock, regeneration)
- Credit gating logic (`useGenerationGate`)
- The actual AI prompt building and day generation logic (reused by `generate-trip`)
- `save-itinerary` action
- All existing itinerary display components

## Expected Result
- User starts generation, can safely refresh or close the tab
- Coming back shows progress or completed itinerary
- Credits are never lost -- server handles refunds on failure
- No more "pay again to finish" scenarios
