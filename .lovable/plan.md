
# Fix: Itinerary Generator Timeout on Long Trips (8+ Days)

## Problem
When generating itineraries for trips longer than ~7-8 days, the generation either times out, throws 500/504 errors, or crashes the page. Users see no itinerary and no clear error message.

## Current Architecture (Already Partially Correct)
The codebase already has the right approach in place: `useItineraryGeneration.ts` calls `generateItineraryProgressive` (day-by-day) first, then falls back to `generateFullItinerary` (monolithic) if it fails. The problem is:

1. The progressive method has **no retry logic** -- if a single day fails, the entire generation fails
2. The fallback is `generateFullItinerary`, which makes one huge API call that times out for 8+ day trips
3. When progressive fails for a non-quota reason, it silently falls into the monolithic path, which then also fails

## Plan

### 1. Add per-day retry logic to `generateItineraryProgressive`
**File:** `src/hooks/useItineraryGeneration.ts`

Wrap the `generate-day` call (lines 331-351) in a retry loop with up to 2 retries per day. Add a short delay (2 seconds) between retries. This means a transient failure on Day 6 doesn't throw away Days 1-5.

### 2. Remove the monolithic fallback
**File:** `src/hooks/useItineraryGeneration.ts`

In `generateItinerary` (lines 422-435), remove the fallback to `generateFullItinerary`. If progressive fails after retries, surface a clear error to the user explaining which day failed and that previous days were saved.

### 3. Auto-save partial progress
**File:** `src/hooks/useItineraryGeneration.ts`

After each successfully generated day, save it to the database immediately (call `saveItinerary` with accumulated days). This way, if the user refreshes or the page crashes on Day 9, Days 1-8 are already persisted.

### 4. Increase rate limit for day generation
**File:** `supabase/functions/generate-itinerary/index.ts`

Change the `generate-day` rate limit from 10 per minute to 20 per minute. A 15-day trip needs 15 sequential calls, and with retries could need up to 45 calls within a few minutes.

## Technical Details

### Retry Logic (Step 1)
```
for each day 1..totalDays:
  attempts = 0
  maxRetries = 2
  while attempts <= maxRetries:
    try generate-day(dayNum)
    on success: break
    on rate-limit/credits error: throw immediately (no retry)
    on other error:
      attempts++
      if attempts > maxRetries: throw with "Day N failed after retries"
      wait 2 seconds, then retry
```

### Files Modified
- `src/hooks/useItineraryGeneration.ts` -- retry logic, remove monolithic fallback, auto-save
- `supabase/functions/generate-itinerary/index.ts` -- rate limit adjustment (line ~2061)

### What This Does NOT Change
- No changes to the edge function's day generation logic
- No changes to the AI prompt or model
- No changes to the UI components
- The `generateFullItinerary` method remains available for other callers but is no longer the fallback
