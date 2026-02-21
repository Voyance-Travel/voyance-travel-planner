

# Fix: Large Trip Generation Timeout

## Problem
A 16-day trip generation gets killed by a **fixed 180-second safety timeout** in `ItineraryGenerator.tsx` (line 192-214). Each day takes ~20-40 seconds to generate (AI call + venue verification + image enrichment), so 16 days needs ~320-640 seconds total. The 180s timeout fires, cancels everything, refunds 960 credits, and shows an error -- even though days were being generated successfully.

The progressive day-by-day loop in `useItineraryGeneration.ts` already has its own per-day 90s timeout with retries. The outer 180s timeout is redundant and harmful for long trips.

## Root Cause
`ItineraryGenerator.tsx` line 192:
```
generationTimeoutRef.current = setTimeout(async () => {
  // fires after 180s regardless of progress
  // kills everything and refunds ALL credits
}, 180_000);
```

This was added as a safety net for when the old monolithic generation would hang. But now that generation is progressive (day-by-day with auto-save), this outer timeout is counterproductive.

## Solution

### 1. Replace fixed 180s timeout with dynamic per-trip timeout
**File:** `src/components/itinerary/ItineraryGenerator.tsx`

Calculate the timeout based on trip length: `totalDays * 60_000` (60 seconds per day) with a minimum of 180s and a maximum of 20 minutes. For a 16-day trip, this gives 960s (16 minutes) instead of 180s (3 minutes).

### 2. Add a "stall detector" instead of a hard timeout
Rather than a single countdown timer, implement a **stall detector** that resets every time a new day completes. If no progress is made for 120 seconds (2 minutes), THEN trigger the timeout/refund. This means:
- A 16-day trip that's steadily generating 1 day every 30s will never trigger the timeout
- A trip that genuinely stalls (edge function down, network issue) will be caught within 2 minutes of the stall

### 3. Partial refund instead of full refund on timeout
When the stall detector fires mid-generation, only refund credits for the **ungenerated** days, not the entire trip. Days 1-5 were already generated and saved -- those credits were earned.

### 4. Fix the Unsplash 404
The image `photo-1563177978-4f4a11e3f462` is still 404ing. Replace with a reliably hosted fallback or remove the hardcoded Unsplash URL entirely.

## Technical Details

### Stall Detector (replaces fixed timeout)
```text
on generation start:
  lastProgressTime = now()
  stallCheckInterval = setInterval(every 10s):
    if (now - lastProgressTime > 120_000):
      // No day completed in 2 minutes -- stalled
      trigger timeout handler
      
on each day complete (from useItineraryGeneration progress):
  lastProgressTime = now()  // reset stall detector

on generation complete or error:
  clear stallCheckInterval
```

### Partial Refund Calculation
```text
creditsPerDay = gateResult.tripCost / totalDays
daysCompleted = state.days.length  (from useItineraryGeneration)
ungenerated = totalDays - daysCompleted
refundAmount = creditsPerDay * ungenerated
```

### Files Modified
- `src/components/itinerary/ItineraryGenerator.tsx` -- replace 180s timeout with stall detector, partial refund logic
- `src/utils/destinationImages.ts` -- fix remaining Unsplash 404 URL

### What This Does NOT Change
- No edge function changes needed
- No changes to the progressive day-by-day generation loop
- No changes to the credit billing/gating system
- The per-day 90s timeout + retry logic in `useItineraryGeneration.ts` stays as-is
