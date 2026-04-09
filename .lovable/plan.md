

# Fix Transit Hallucination — "Travel to A" and "Travel to B"

## Root Cause

CRITICAL REMINDERS item 13 in `compile-prompt.ts` (line 1273) says:
> "Activity **B** cannot start before Activity **A** ends."

The AI sometimes interprets "A" and "B" as literal activity/venue names and generates transit cards titled "Travel to A" or "Walk to B". There is no guard in the repair pipeline to catch these single-letter or placeholder destinations.

## Changes

### 1. Reword prompt to avoid abstract "A" / "B" labels
**File: `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`** (line 1273)

Change item 13 from:
> "Activity B cannot start before Activity A ends..."

To:
> "The NEXT activity cannot start before the PREVIOUS activity ends..."

This eliminates the source of the "A" and "B" hallucination.

### 2. Add placeholder destination guard in `repair-day.ts`

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

Add a helper function `isPlaceholderDestination(name)` that returns true for:
- Single-letter names (e.g., "A", "B", "C")
- Known generic placeholders ("next venue", "destination", "previous location", "next stop", "Activity A", "Activity B")

Then update `generateTransitLabel` (~line 395) to skip placeholder names when building the transit title — if the resolved destination is a placeholder, fall back to the next available field (venue_name, title) and log a `[TRANSIT-PLACEHOLDER]` warning.

Also add a sweep pass (after the existing transport title sync in step 15a, ~line 2658) that catches any remaining transit cards whose title ends with a placeholder destination and rewrites them using the actual next non-transport activity's name.

### 3. Deploy
- Deploy `generate-itinerary` edge function

## What's NOT Changed
- Transit calculation math or duration estimates
- Activity generation or selection
- Database schema
- Other prompt items (items 14-16 are unaffected)

