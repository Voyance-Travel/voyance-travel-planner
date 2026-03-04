

## Plan: Fix Generation Progress UI — Replace Fake Spinner with Live Polling

### Root Cause

The `prePhase` at line 991 renders `GenerationPhases` (the fake globe/phase stepper). The useEffect at line 219 SHOULD clear `prePhase` when `serverGenActive` becomes true, revealing the real progress view at line 1020. But there are two problems:

1. **If `startServerGeneration` throws** (edge function timeout, 403, etc.), the catch at line 455 falls back to `generateItinerary` (frontend loop). `setServerGenActive(true)` at line 453 is **never reached**. The frontend loop also likely fails or produces nothing, so `days.length` stays 0, `prePhase` stays set, and the user sees the fake spinner forever.

2. **Even if `serverGenActive` works**, the server progress view at line 1020 only shows day titles from the poller — it doesn't show during the `prePhase` block. The `GenerationPhases` component itself does zero polling.

### The Fix: Make GenerationPhases poll directly

Instead of relying on the complex `prePhase` → `serverGenActive` handoff, **rewrite `GenerationPhases.tsx`** to accept `tripId` and `totalDays`, poll `itinerary_days` itself, and show live day-by-day progress. This way, even if it's rendered via the `prePhase` block (line 991), users see real progress.

### Changes

#### 1. Rewrite `GenerationPhases.tsx` — complete replacement

Delete all current content (globe, phase stepper, travel quotes, rotating activities). Replace with:

- Accept props: `tripId?: string`, `totalDays?: number`, `destination?: string`, `currentStep` (kept for brief initial display)
- Internal state: `days[]` from polling `itinerary_days`, `isComplete` boolean
- `useEffect` with 5-second polling interval when `tripId` is provided:
  - Query `itinerary_days` for `day_number, title, theme` ordered by `day_number`
  - Query `trips` for `itinerary_status`
  - Set `isComplete` when status is `'ready'` or `'generated'`
- Render:
  - Header: "Building Day X of Y" with sparkle icon
  - Progress bar: `completedDays / totalDays * 100`
  - Time estimate: `~${Math.ceil(remainingDays * 1.2)} min remaining`
  - Completed days list: day number badge + title + theme + checkmark, animated fade-in
  - Currently generating day: pulsing placeholder
  - Upcoming days: faded placeholders (max 3 shown)
  - "Feel free to leave" message at bottom
  - When complete: "Your itinerary is ready!" with checkmark

If `tripId` is not provided (shouldn't happen but fallback), show a simple "Preparing..." spinner.

#### 2. Update `ItineraryGenerator.tsx` — pass `tripId` to GenerationPhases

At line 998 where `GenerationPhases` is rendered inside the `prePhase` block:

```tsx
<GenerationPhases currentStep={prePhase} destination={destination} totalDays={totalDaysEstimate} tripId={tripId} />
```

This is the key change — `GenerationPhases` now receives `tripId` and can poll `itinerary_days` directly.

#### 3. Remove redundant server progress view in `ItineraryGenerator.tsx`

The `serverGenActive` block (lines 1020-1146) becomes redundant since `GenerationPhases` now handles all progress display. However, to minimize risk, keep the `serverGenActive` block but have it also render the rewritten `GenerationPhases` component:

```tsx
if (serverGenActive) {
  return (
    <div className="py-10">
      <GenerationPhases tripId={tripId} totalDays={totalDaysEstimate} destination={destination} currentStep="preparing" />
    </div>
  );
}
```

This ensures both code paths (`prePhase` block and `serverGenActive` block) show the same live progress UI.

### Files to modify

| File | What |
|------|------|
| `src/components/planner/shared/GenerationPhases.tsx` | Complete rewrite — poll `itinerary_days`, show live day-by-day progress |
| `src/components/itinerary/ItineraryGenerator.tsx` | Pass `tripId` to GenerationPhases at line 998; simplify `serverGenActive` block to use same component |

### Why This Fixes All Three Scenarios

1. **User stays during generation**: `GenerationPhases` polls every 5s, shows days appearing live
2. **User leaves mid-generation**: "Feel free to leave" message visible; when they return, TripDetail.tsx detects generating state (already working)
3. **User returns after completion**: TripDetail.tsx shows full itinerary (already working)

