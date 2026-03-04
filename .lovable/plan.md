

# Fix: Real-Time Progress During Server-Side Generation

## Problem Summary

When server-side generation is active, **two things go wrong**:

1. **ItineraryGenerator shows a dead UI**: After calling `startServerGeneration`, it sets `serverGenActive = true` and renders the "generating" view — but that view reads `isGenerating`, `progress`, and `days` from the **frontend generation hook** (`useItineraryGeneration`), which has nothing happening. The poller data (`poller.partialDays`, `poller.completedDays`, `poller.progress`) is fetched correctly but **never wired into the UI**.

2. **No progressive day rendering in ItineraryGenerator**: The `EditorialItinerary` progressive preview only exists in `TripDetail.tsx` (lines 1395-1413), not in `ItineraryGenerator.tsx`. So while staying on the generator screen, the user sees a frozen spinner.

3. **"You can safely leave" messaging is buried**: It exists in TripDetail (line 1388) but is a small, low-contrast line. It's missing entirely from the ItineraryGenerator view.

## Changes

### 1. Wire poller data into ItineraryGenerator's generating UI
**File: `src/components/itinerary/ItineraryGenerator.tsx`**

When `serverGenActive` is true, render a **server-generation-specific progress view** instead of the frontend-loop progress view. This view should:

- Use `poller.completedDays` / `poller.totalDays` for progress text
- Use `poller.progress` for the progress bar
- Show `poller.partialDays` using `EditorialItinerary` (same pattern as TripDetail lines 1396-1413)
- Show the "Generating Day X..." skeleton for the next day
- Display a clear "You can safely leave" message with emphasis (not buried text)
- Show the `PersonalizedLoadingProgress` component during the initial wait (before day 1 completes)

The logic: detect `serverGenActive` early in the render flow and return a dedicated server-progress block that bypasses the existing frontend-loop UI entirely.

### 2. Improve "safe to leave" messaging
**Files: `ItineraryGenerator.tsx` and `TripDetail.tsx`**

Upgrade the messaging from a tiny muted line to a visible callout:
- Use an info-style card/banner: "Your itinerary is being built in the cloud. You can close this page or navigate away — it'll be waiting for you when you come back."
- On the TripDashboard, the trip already shows a "Generating itinerary…" badge (line 454) — confirm this links back to the trip detail correctly (it does via normal card click).

### 3. Remove duplicate poller instances
**File: `src/components/itinerary/ItineraryGenerator.tsx`**

The ItineraryGenerator has its own `useGenerationPoller` (line 120), AND TripDetail has another one (line 151). When both are mounted simultaneously, they both poll every 3s — doubling DB reads for no reason.

Fix: ItineraryGenerator's poller is the one that's active during initial generation. TripDetail's poller only activates when the user returns to a trip that's already generating (no ItineraryGenerator mounted). This is already roughly correct because ItineraryGenerator's poller uses `serverGenActive` and TripDetail's uses `isServerGenerating`. But when ItineraryGenerator is mounted AND `serverGenActive` is true, both fire. 

Solution: Pass the poller state down from TripDetail to ItineraryGenerator as a prop, OR have ItineraryGenerator skip its own poller when not needed. Simplest: keep ItineraryGenerator's poller (it's the one active during initial gen) and disable TripDetail's when `showGenerator` is true.

### 4. Poll interval tuning
**File: `src/hooks/useGenerationPoller.ts`**

No change needed — already at 3s in ItineraryGenerator and 3s in TripDetail. This is appropriate for active generation.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/itinerary/ItineraryGenerator.tsx` | Add server-gen progress view with partial day rendering, PersonalizedLoadingProgress, and "safe to leave" banner |
| `src/pages/TripDetail.tsx` | Disable TripDetail's poller when ItineraryGenerator is mounted to avoid double-polling; improve "safe to leave" copy |

## What stays the same
- The poller hook itself (working correctly)
- The edge function (writing heartbeat + partial days correctly)
- TripDashboard's "Generating itinerary…" badge
- Resume/stalled detection logic

