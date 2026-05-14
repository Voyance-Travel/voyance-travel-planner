## What was being attempted

Two prior prompts asked me to extract "auto-resume" logic out of `TripDetail.tsx` into a new `useAutoResume` hook, with the goal of centralizing the gate that prevents an itinerary from being silently regenerated on page load (the "refresh gives a different itinerary" bug).

## What I actually found in the code

I grepped every reference to `autoResumeAttempted` and `handleResumeGeneration` in `TripDetail.tsx`:

```
305:   const autoResumeAttemptedRef = useRef(false);     // declared
1992:  autoResumeAttemptedRef.current = false;           // reset on unmount
3107:  <Button onClick={handleResumeGeneration} ... />   // manual button only
```

That's it. The two sites the original prompt referenced (1679 and 1897) are **already inert** — they only do `console.warn(...)` + `setGenerationStalled(true)`. They do NOT call `handleResumeGeneration`. The `autoResumeAttemptedRef` is declared and reset but never *read* anywhere — it's a vestige left over from when auto-resume was removed during the Dublin 2026-05-14 fix.

In other words: **the auto-resume call was already deleted weeks ago.** What remained was just the stalled-UI gate, which is correct and already in the right place.

## Verdict on the hook

`src/hooks/useAutoResume.ts` (which we created last turn) is solving a problem that no longer exists. It even contains an `if (!attemptedRef.current && status === 'pending') handleResumeGeneration()` branch that, if wired in, would *re-introduce* the very auto-fire we deliberately removed. Wiring it in would be a regression.

## Proposed fix

1. **Delete `src/hooks/useAutoResume.ts`** — dead code that risks regression if anyone wires it in.
2. **Delete `autoResumeAttemptedRef`** declaration (line 305) and its cleanup reset (line 1992) in `TripDetail.tsx` — vestigial ref no one reads.
3. **Leave the two `NOT auto-resuming` console.warn sites alone** — they already do the right thing (set stalled UI, no auto-fire).
4. **Document the real refresh-protection chain in memory** so future agents don't keep trying to "extract" auto-resume:
   - The actual "refresh doesn't change the itinerary" guarantees live in:
     - **Frozen After Ready** (`safeUpdateItineraryData` silent no-op when `itinerary_frozen_at` set or status ∈ {ready, generated})
     - **No-Regression Overwrite Guard** (`persistTripItinerary` blocks materially worse writes)
     - **DB Is Source of Truth** (`TRIP_PERSISTED_EVENT` re-reads canonical data; no on-mount cascade mutations)
   - These are already in the Core memory section and already shipped. The user's complaint either (a) predates those landing, (b) is hitting a trip persisted before the freeze stamp existed, or (c) is a different leak path that needs reproduction before fixing.

## After cleanup

If the user is still seeing "refresh changes the itinerary" on a *fresh* trip generated after 2026-05-13, that's a real bug we need to reproduce — but it would be in a different code path (e.g. a write site that bypasses `safeUpdateItineraryData`, or a trip that never gets the `itinerary_frozen_at` stamp). The next step there would be to grab a specific affected trip ID, inspect `metadata.itinerary_frozen_at` + `itinerary_status`, and check edge function logs for any non-self-heal write after the user first saw the trip.

## Files touched

- DELETE `src/hooks/useAutoResume.ts`
- EDIT `src/pages/TripDetail.tsx` — remove dead `autoResumeAttemptedRef` (2 lines)
- ADD memory entry warning future agents not to re-extract auto-resume