

# Fix: Trip Detail Page Unstable on Generation Confirmation

## Problem
The trip page at `/trip/:id?generate=true` is unstable — it "spasms" because:

1. **Missing guard on auto-generate effect** (line 804-816): The `useEffect` that calls `handleShowGenerator(true)` fires for ANY trip without itinerary data, regardless of whether `?generate=true` is in the URL. It should only auto-trigger when `shouldAutoGenerate` is true.

2. **Effect re-fires on its own side effects**: The effect's dependency array includes `shouldAutoGenerate`, but a second branch inside the same effect (line 818-824) deletes the `generate` param from the URL. This changes `shouldAutoGenerate` from `true` to `false`, causing the effect to re-run. The ref guard (`autoGenerateTriggered`) partially prevents this, but the state churn still causes re-renders and visual instability.

3. **Console error spam**: The "message channel closed" errors in the screenshot are from browser extensions, not app code. Already suppressed by `GlobalErrorHandler` — no fix needed.

## Changes

### `src/pages/TripDetail.tsx`

**Fix 1: Add `shouldAutoGenerate` guard to the auto-trigger condition (line 805)**

Add `shouldAutoGenerate &&` to the condition so generation only auto-starts when `?generate=true` is present:

```typescript
if (
  shouldAutoGenerate &&  // ← ADD THIS
  trip && 
  !loading && 
  !autoGenerateTriggered.current &&
  !isServerGenerating &&
  trip.itinerary_status !== 'generating' &&
  trip.itinerary_status !== 'queued' &&
  (!hasItineraryData(trip) || trip.itinerary_status === 'failed')
) {
  autoGenerateTriggered.current = true;
  handleShowGenerator(true);
}
```

**Fix 2: Split the URL cleanup into a separate effect**

Move the URL param cleanup (lines 817-824) into its own `useEffect` so it doesn't cause the auto-trigger effect to re-fire. This eliminates the dependency cycle where deleting `?generate=true` changes `shouldAutoGenerate` and re-runs the trigger logic.

**Fix 3: Clean up URL param immediately on trigger**

When `autoGenerateTriggered.current` is set to `true`, also remove `?generate=true` from the URL in the same step. This prevents the loading spinner branch in the JSX (line 2175) from flickering between states.

### Result
- Draft trip page without `?generate=true` → shows the "Ready to plan your adventure?" CTA card (no auto-trigger)
- Trip page with `?generate=true` → triggers generation once, cleans URL, shows generator
- No more re-render loops or visual spasming

