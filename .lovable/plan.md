

## Plan: Remove Browser Loop Fallback + Client-Side Stall Detector

### What's Already Working (No Changes Needed)
- **Backend self-chaining**: `generate-trip` → `generate-trip-day` → self-chain is fully implemented (lines 12124-12563 of edge function)
- **`startServerGeneration`**: Already calls `generate-trip` action (fire-and-forget)
- **`GenerationPhases.tsx`**: Already polls `itinerary_days` every 5s and shows live day-by-day progress
- **`useGenerationPoller`**: Already detects stalls via heartbeat and auto-resumes

### What's Broken — Two Things

**1. Fallback to browser loop** (ItineraryGenerator.tsx lines 456-469): When `startServerGeneration` throws, the catch block falls back to `generateItinerary()` — the browser-side for-loop. This means any server-side error (timeout, 403, network blip) reverts to the broken browser-dependent path.

**2. Client-side stall detector** (ItineraryGenerator.tsx lines 261-313): A `setInterval` every 10s checks `Date.now() - lastProgressTimeRef.current > 600_000`. During server-side generation, `lastProgressTimeRef` is never updated (it's only reset when `days.length` changes in the browser-side hook, which doesn't happen during server gen). So after 10 minutes, this fires `handleStallTimeout` → cancels generation → refunds credits → shows "Generation timed out." This is the thing that kills generation when the user walks away and comes back.

### Changes

#### File 1: `src/components/itinerary/ItineraryGenerator.tsx`

**Change A — Remove stall detector setup** (lines ~261-313):
Remove the `stallCheckRef` `setInterval` setup and the `handleStallTimeout` function from `handleGenerate`. The server-side heartbeat + `useGenerationPoller` auto-resume already handles stall detection properly.

**Change B — Remove browser loop fallback** (lines ~455-469):
Replace the `catch` block that falls back to `generateItinerary()` with a simple error display. If `startServerGeneration` fails, show the error to the user and let them retry — don't silently fall back to a broken browser loop.

```typescript
// OLD:
} catch (serverErr) {
  console.warn('Server-side generation failed, falling back to frontend loop:', serverErr);
  const generatedDays = await generateItinerary({ ... });
  // ... 40 lines of fallback logic
}

// NEW:
} catch (serverErr) {
  console.error('[ItineraryGenerator] Server-side generation failed:', serverErr);
  setPrePhase(null);
  setHasStarted(false);
  toast.error('Failed to start generation. Please try again.');
  return;
}
```

**Change C — Clean up stall detector references**: Remove all `stallCheckRef` cleanup calls scattered throughout error handlers (lines 132, 149, 265, 356, 387, 410, 476-477), since the stall detector no longer exists. Remove `stallCheckRef` and `lastProgressTimeRef` declarations and the `useEffect` that resets the stall detector on `days.length` change (lines 206-212).

**Change D — Remove `generationTimeoutRef` cleanup** if it's also unused (verify it's only used alongside stallCheck).

#### File 2: `src/hooks/useItineraryGeneration.ts`

No changes needed to the hook itself — `generateItineraryProgressive` and `generateItinerary` can stay as dead code for now. They're only called from the fallback path we're removing. Removing them is optional cleanup.

### Files to Modify

| File | What |
|------|------|
| `src/components/itinerary/ItineraryGenerator.tsx` | Remove stall detector, remove browser loop fallback, clean up refs |

### Risk Assessment
- **Low risk**: The server-side self-chaining is already fully implemented and tested
- The `useGenerationPoller` already handles stall detection via heartbeat (3-min threshold) and auto-resumes
- The only regression risk: if `startServerGeneration` fails on first call, user now sees an error instead of silently falling back. This is actually better UX — the fallback was broken anyway.

