

# Flight Intelligence Pipeline Upgrade

## Problem
When users paste airline confirmations in the Step 2 modal, the system extracts raw segments but doesn't reason about them. Layover airports get treated as destinations, missing legs aren't detected, and the itinerary generator schedules activities during layovers.

## Overview
This upgrade touches 4 layers: the AI parsing edge function, the import modal UI, trip state persistence, and the itinerary generation prompt pipeline.

---

## Area 1: Upgrade `parse-booking-confirmation` Edge Function

**File:** `supabase/functions/parse-booking-confirmation/index.ts`

- Accept an optional `tripContext` object alongside `confirmationText`:
  ```text
  { destinations, destinationAirports, tripDates, nightsPerCity }
  ```
- Expand the LLM prompt (two-phase approach within a single call):
  1. **Extract** all raw flight segments (existing behavior)
  2. **Analyze** segments against `tripContext` to produce an `intelligence` block:
     - **Classify** each segment: `OUTBOUND`, `RETURN`, `CONNECTION` (same airport within 6h), `INTER_DESTINATION`
     - **Detect missing legs** between consecutive destinations with reason, suggested date range, and priority
     - **Calculate availability windows** per destination:
       - `availableFrom` = arrival + 3h (international) or +1.5h (domestic)
       - `availableUntil` = departure - 3.5h (international) or -2.5h (domestic)
     - **Build route summary** with layover markers: `Dallas -> (layover: Madrid) -> [Mallorca] -> [Madrid] -> Dallas`
     - **Identify layovers** with airport, times, and duration
     - **Generate warnings** array
- Update response interface to include `intelligence` alongside `booking`
- Add server-side validation/defaults for the intelligence block (handle cases where AI omits fields)
- Sort segments chronologically by departure datetime
- Never discard any user-provided segment data

---

## Area 2: Upgrade Flight Import Modal Frontend

**File:** `src/components/itinerary/FlightImportModal.tsx`

**Props changes:**
- Add `destinations`, `destinationAirports`, `nightsPerCity` props (sourced from Start.tsx trip state)

**API call changes:**
- Pass `tripContext` to the edge function call alongside `confirmationText`

**New UI in review step (before individual segment cards):**

1. **Flight Analysis Card** -- a summary card showing:
   - Intelligent route display (with "(layover)" labels)
   - Destination schedule table (city, available dates, available times)
   - Summary text from `intelligence.summary`

2. **Missing Leg Warnings** -- amber alert cards for each missing leg:
   - Warning message explaining why it's needed
   - Suggested booking window
   - "Help me find this flight" button (future: links to search)

3. **"Does this look right?" prompt** with Yes / Adjust buttons

**Segment card enhancements:**
- Add classification badge (pill) on each segment header: "Outbound", "Connection", "Return", "Inter-destination"
- For `isLayoverArrival: true` segments, replace "Used to plan Day 1" text with "Connection -- your journey continues to [next city]"
- Group segments with the same `connectionGroup` visually (connected card styling, vertical connector line)

**File:** `src/pages/Start.tsx`
- Pass trip context data (destinations, airports, nights per city) to `FlightImportModal` props

---

## Area 3: Store Flight Intelligence in Trip State

**File:** `src/pages/Start.tsx` (and related state)

- When user confirms import in the modal, store the full `intelligence` object alongside flight legs in the trip state
- Persist `intelligence` data into the trip's `flight_selection` JSON blob (or a new `flight_intelligence` field on the `trips` table if needed)
- This data flows through to `generate-itinerary` when "Build My Itinerary" is clicked

**Database:** Add a `flight_intelligence` JSONB column to the `trips` table (nullable, default null) via migration. This stores `destinationSchedule`, `layovers`, `missingLegs`, `route`, and `warnings`.

---

## Area 4: Update Itinerary Generation to Use Flight Intelligence

**File:** `supabase/functions/generate-itinerary/index.ts`

- In the flight/hotel data loading stage (~Stage 1.4), read `flight_intelligence` from the trip record
- If present, inject a new prompt section into the day generation prompt:

**New prompt rules:**
- **FLIGHT-AWARE SCHEDULING**: For each destination in `destinationSchedule`, enforce `availableFrom` and `availableUntil` as hard constraints on the day's activity window
- **LAYOVER EXCLUSIONS**: For each layover, explicitly instruct the AI to schedule zero activities in that city during the layover window
- **FIRST/LAST DESTINATION**: Lighter schedule on arrival day (2-3 activities, afternoon/evening only); last day ends by `availableUntil`
- **MISSING LEG HANDLING**: Leave travel days between missing-leg cities flexible with a "Travel day -- flight not yet booked" note
- **TRAVEL INTEL COVERAGE**: Generate Travel Intel for ALL cities in `destinationSchedule`, not just the first

**File:** `supabase/functions/generate-itinerary/prompt-library.ts`

- Update `extractFlightData()` to also check for `flight_intelligence` and produce per-destination timing constraints
- Add a new `buildFlightIntelligencePrompt(intelligence)` function that generates the prompt section described above
- Update `DayConstraints` interface to include destination-specific availability windows from intelligence data

**File:** `src/services/itineraryAPI.ts`

- When calling `generate-itinerary`, include the `flight_intelligence` data from the trip record in the request body

---

## Sequencing

1. Database migration: add `flight_intelligence` JSONB column to `trips`
2. Update `parse-booking-confirmation` edge function (new prompt, new response format, backward-compatible)
3. Update `FlightImportModal` (new props, new UI sections, intelligence display)
4. Update `Start.tsx` (pass context to modal, store intelligence on confirm)
5. Update `prompt-library.ts` (new `buildFlightIntelligencePrompt` function)
6. Update `generate-itinerary/index.ts` (read intelligence, inject into prompt pipeline)
7. Update `itineraryAPI.ts` (pass intelligence in request body)
8. Deploy edge functions and test end-to-end

## Edge Cases Handled

- No `tripContext` provided: function falls back to current extraction-only behavior (backward compatible)
- Single-city trips: intelligence still generated but simpler (no missing legs, no inter-destination classification)
- AI fails to produce intelligence block: server-side defaults applied, segments still returned
- Layover city is also a destination: classified independently based on timing context

