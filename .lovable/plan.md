

## Fix: Increase Flight Buffer to 3 Hours

The user wants a consistent 3-hour (180-minute) buffer before departure flights across the entire system. Currently, different files use different values (120min, 135min, 150min), creating inconsistency.

### Changes Required

**1. `supabase/functions/generate-itinerary/prompt-library.ts`** (~line 284)
- `airportBuffer` base value: `120` → `180` (domestic flights)
- Already `180` for international — keep as-is
- This controls the prompt-level "latest end time" calculation

**2. `supabase/functions/generate-itinerary/pipeline/compile-day-schema.ts`** (~line 416)
- `checkInBuffer` is already `180` — no change needed here ✓

**3. `supabase/functions/generate-itinerary/pipeline/repair-day.ts`** (~line 1793)
- `airportBuffer`: `150` → `180`
- This controls the departure-day time window enforcement in the repair pipeline

**4. `supabase/functions/generate-itinerary/flight-hotel-context.ts`** (~line 253)
- `DEPARTURE_BUFFER_MINS` is already `3 * 60` (180) — no change needed ✓

**5. `src/services/flightItineraryPatch.ts`** (~lines 150-151)
- `latestEnd = departMins - 120` → `departMins - 180`
- `transferStart = departMins - 150` → `departMins - 210`
- This controls the post-generation flight patch

**6. `src/services/cascadeTransportToItinerary.ts`** (~line 20)
- `flight.beforeDeparture`: `135` → `180`
- This controls the cascade transport sync buffer

### Summary
Four files need updates; two already use 180 minutes. All departure-side flight buffers will be unified to 180 minutes (3 hours).

