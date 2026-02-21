

# Fix: Relax All Generation Timeouts for Large Trips

## Problem
The per-day generation timeout (90 seconds) and retry delays (3s/6s/10s/15s) are too aggressive for complex multi-day itineraries. Day 6 hit a slow AI response, timed out at 90s, retried with short delays, but the retries also hit infrastructure that hadn't recovered yet. After exhausting retries, the stall detector (still showing "120s" from cached build) killed the whole process.

## Changes

### 1. Increase per-day timeout from 90s to 180s
**File:** `src/hooks/useItineraryGeneration.ts` (line 368)

Change `90_000` to `180_000`. Each day involves AI generation + venue verification + image enrichment. For complex destinations, 90s is simply not enough.

### 2. Increase retry count from 4 to 6
**File:** `src/hooks/useItineraryGeneration.ts` (line 323)

Change `MAX_RETRIES = 4` to `MAX_RETRIES = 6`. More chances to recover from transient infrastructure timeouts.

### 3. Increase backoff delays significantly
**File:** `src/hooks/useItineraryGeneration.ts` (line 324)

Change from `[3000, 6000, 10000, 15000]` to `[5000, 10000, 20000, 30000, 45000, 60000]`. Give the backend time to recover between retries instead of hammering it immediately.

### 4. Fix misleading comment in stall detector
**File:** `src/components/itinerary/ItineraryGenerator.tsx` (line 200)

Update the comment from "120s" to "600s" to match the actual threshold, so future debugging isn't confusing.

## Summary

| Setting | Before | After |
|---|---|---|
| Per-day timeout | 90 seconds | 180 seconds |
| Max retries per day | 4 | 6 |
| Backoff delays | 3s, 6s, 10s, 15s | 5s, 10s, 20s, 30s, 45s, 60s |
| Stall detector | 600s (correct) | 600s (unchanged) |
| Comment accuracy | Says "120s" | Fixed to "600s" |

### Files Modified
- `src/hooks/useItineraryGeneration.ts` -- per-day timeout, retry count, backoff delays
- `src/components/itinerary/ItineraryGenerator.tsx` -- fix misleading comment

### What This Means in Practice
A 16-day trip where each day takes up to 180s with retries now has a theoretical max runtime of ~48 minutes (worst case: every day needs all 6 retries with full 60s backoff). The 600s stall detector will only fire if NO day completes for 10 straight minutes -- a true dead connection.

