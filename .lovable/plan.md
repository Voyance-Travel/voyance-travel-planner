

# Fix Minimum Activity Durations, Dead Gaps & Venue Name Preservation

## Problem
1. Museum visits get 30-min slots (should be 60+ min). The existing minimum duration enforcement (line 2456) only covers dining at 60min and sightseeing at 30min — it doesn't have museum/wellness-specific minimums or title-based detection.
2. Large dead gaps (3+ hours) between activities go unfilled.
3. Venue names can get overwritten with wrong Google Places matches.

## Changes

### 1. Enhance minimum duration enforcement in `repair-day.ts`
**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`** (~line 2456-2481)

Replace the existing `13b. MINIMUM DURATION ENFORCEMENT` block with enhanced category + title-keyword logic:

- Add title-based detection: if title contains "museum"/"musée" → 60min, "gallery"/"galerie" → 45min, "spa"/"hammam"/"wellness" → 60min
- Expand category map: `cultural` → 60min (was grouped with sightseeing at 30min), `wellness` → 60min
- Keep existing: dining/food/restaurant → 60min, activity/sightseeing/entertainment → 30min
- The overlap cascade after (lines 2484-2501) and late-activity drop (lines 2503+) remain unchanged

### 2. Add dead-gap and duration prompt rules in `compile-prompt.ts`
**File: `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`** (~line 1274)

Add items 15-16 to CRITICAL REMINDERS:
- Item 15: NO DEAD GAPS OVER 90 MINUTES — fill with extended activities or add café/park/shopping filler
- Item 16: MINIMUM ACTIVITY DURATIONS — museum/cultural = 60min, spa = 60min, meals = 45min, breakfast = 30min, nothing under 30min

### 3. Add venue name mismatch guard in `venue-enrichment.ts`
**File: `supabase/functions/generate-itinerary/venue-enrichment.ts`** (~line 640, inside `enrichActivity`)

Add a `shouldPreserveOriginalName()` check before applying any venue data that could affect the name. Even though the current code doesn't explicitly overwrite `location.name`, add a defensive guard:
- Add `shouldUseEnrichedName(original, enriched)` function using word-overlap ratio (< 30% overlap = mismatch)
- Before the venue data application block, if `venueData.formattedName` or display name exists, check overlap with original title/venue_name
- If mismatch detected, log `[VENUE-MISMATCH]` and ensure `location.name` stays as the original
- Still apply coordinates, address, rating, etc. from the enrichment (just protect the name)

Also add the guard in `verifyVenueWithGooglePlaces()` (~line 240): if the Google Places `displayName.text` has < 30% word overlap with the queried `venueName`, reduce confidence to 0.3 and log the mismatch. This prevents bad matches from propagating.

### 4. Deploy
- Deploy `generate-itinerary` edge function

## What's NOT changed
- Transit calculations (Prompt 83)
- Scheduling overlap logic (Prompt 84)
- Activity generation or selection
- Database schema

