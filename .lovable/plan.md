

## Plan: Fix Generation Progress — Replace Fake Spinner with Live Day-by-Day Progress

### Root Cause (Confirmed)

The rendering order in `ItineraryGenerator.tsx` is:
1. Error state → line 962
2. **`prePhase` check → line 991** — renders `GenerationPhases` (the fake spinner)
3. `serverGenActive` check → line 1020 — renders the real progress view

The problem: `prePhase` is set to `'preparing'` before `startServerGeneration()` is called (line 327). It's only cleared when `days.length > 0` (line 219), but `days` comes from `useItineraryGeneration()` (the frontend loop hook), NOT from the poller. With server-side generation, `days` never gets populated, so **`prePhase` never clears** and the user is permanently stuck on the fake `GenerationPhases` spinner.

The `serverGenActive` progress view (line 1020) — which already has progress bar, "Building in the cloud" messaging, and day-by-day rendering — is **never reached** because the `prePhase` check comes first.

### Fix: Two Changes

#### Change 1: Clear `prePhase` when server generation is active (`ItineraryGenerator.tsx`)

In the `useEffect` that clears `prePhase` (lines 216-222), add `serverGenActive` as a trigger:

```typescript
useEffect(() => {
  if (!prePhase) return;
  if (days.length > 0 || status === 'error' || status === 'complete' || serverGenActive) {
    setPrePhase(null);
  }
}, [prePhase, days.length, status, serverGenActive]);
```

This is the **one-line fix** that unblocks everything. Once `serverGenActive` becomes true (line 453, right after `startServerGeneration` succeeds), `prePhase` clears, and the existing server progress view at line 1020 renders.

#### Change 2: Show `generatedDaysList` from poller in the progress view (`ItineraryGenerator.tsx`)

The server progress view (lines 1020-1119) currently uses `poller.partialDays` (from `itinerary_data.days` on the trips table) for the `EditorialItinerary` component. But during generation, `itinerary_data` may be empty while `itinerary_days` table rows exist.

Update the progress view to also use `poller.generatedDaysList` (from the `itinerary_days` table) to show a simple day list when `partialDays` is empty but `generatedDaysList` has entries:

- Show `poller.generatedDaysList` items as completed day summaries (day number + title + theme + checkmark)
- Show the "currently generating" pulsing placeholder for `completedDays + 1`
- Add time estimate: `~${Math.ceil((poller.totalDays - poller.completedDays) * 1.2)} min remaining`
- Add "Feel free to leave" text (already present as "Building in the cloud" banner — no change needed)

#### Change 3: Fix time estimate in `GenerationPhases.tsx`

The `GenerationPhases` component is still shown briefly during the pre-authorization phase (before server gen starts). Update the time estimate text (line 288-294) — this was already partially done but the component still says "Usually takes 2-4 minutes" for short trips. This is minor since users will only see it for ~2 seconds now.

### Files to modify

| File | Change | Lines |
|------|--------|-------|
| `src/components/itinerary/ItineraryGenerator.tsx` | Add `serverGenActive` to prePhase clear condition; enhance server progress view with `generatedDaysList` | ~219, ~1020-1119 |
| `src/components/planner/shared/GenerationPhases.tsx` | No major changes needed — it's now only shown for ~2s during pre-auth | Minor |

### Why This Works

The existing code already has:
- Poller querying `itinerary_days` table every 3s ✅
- `generatedDaysList` with day summaries ✅  
- "Building in the cloud" banner ✅
- Progress bar with `poller.progress` ✅
- "Generating Day X..." skeleton ✅
- Completion detection via `onReady` ✅

All of this is just never rendered because `prePhase` blocks it. One condition change fixes the entire UX.

