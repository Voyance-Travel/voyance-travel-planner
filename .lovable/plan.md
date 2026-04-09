

# Fix Scheduling Overlaps & Hotel Round-Trip Time Math

## Problem
Activities overlap because: (1) the overlap cascade runs before bookend repairs inject new activities, and (2) hotel freshen-up insertion doesn't account for round-trip transit time.

## Changes

### 1. Fix mid-day hotel freshen-up insertion with transit math
**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`** (~line 3133-3144)

The current code inserts a freshen-up card 15 min after the previous activity ends, ignoring transit to/from the hotel. Replace with proper round-trip calculation:

- Calculate transit from previous activity to hotel using `estimateTransit()` (or `getDefaultTransitMinutes()` fallback)
- Calculate transit from hotel to dinner using `estimateTransit()` (or fallback)
- Work backwards from dinner start: `freshenEnd = dinnerStart - hotelToDinnerTransit`, `freshenStart = freshenEnd - 30` (freshen duration), `mustLeaveBy = freshenStart - prevToHotelTransit`
- Only insert if `mustLeaveBy >= prevActivityEnd` — otherwise skip the freshen-up (not enough time)
- Use calculated times for the transport card and accommodation card instead of hardcoded `offset(prevEnd, 15)`

### 2. Add final sequential enforcement pass after bookend repairs
**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`** (~line 3470, just before `return { activities: deduped, repairs }`)

Add a final overlap sweep on the `deduped` array that catches any overlaps introduced by bookend repairs (hotel returns, transit injection, consolidation):

```
for each consecutive pair in deduped:
  if curr.startTime < prev.endTime:
    push curr (and all subsequent) forward by the overlap amount
    log repair
```

This is intentionally simple — it's a safety net, not the primary repair. It runs after ALL other processing.

### 3. Add CRITICAL REMINDERS 13-14 to prompt
**File: `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`** (~line 1272)

Add after item 12:
- Item 13: TIME OVERLAP CHECK — Activity B cannot start before Activity A ends. Hotel freshen-up requires: transit TO hotel + time AT hotel + transit FROM hotel to restaurant, all fitting before dinner start.
- Item 14: HOTEL ROUND-TRIP MATH — If the three components don't fit between previous activity end and dinner start, skip the hotel visit.

### 4. Deploy
- Deploy `generate-itinerary` edge function

## What's NOT changed
- Existing overlap cascade logic (step 13) — still runs, catches early overlaps
- Activity generation or reordering logic
- Transit calculation (that's Prompt 83)
- Database schema

