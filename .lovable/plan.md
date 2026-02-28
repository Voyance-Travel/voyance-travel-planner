

# Fix Flight Intelligence Bugs — Layover Detection, Arrival Times, Missing Legs, Travel Intel

## Problem Summary

Six interconnected bugs where the system treats layover airports as destinations, uses wrong arrival times, fabricates missing flights, and generates Travel Intel for only the first city.

## Root Cause Analysis

The bugs stem from **two independent data paths that conflict**:

1. **`getFlightHotelContext()`** in `generate-itinerary/index.ts` reads `flight_selection.departure.arrival.time` — which is the FIRST leg's arrival (MAD 12:15 for a layover), not the actual destination arrival (PMI 18:25). This produces the **wrong** Day 1 constraint.

2. **`buildFlightIntelligencePrompt()`** in `prompt-library.ts` reads `flight_intelligence.destinationSchedule` which has the CORRECT `availableFrom` time — but it's injected as supplementary text that contradicts the "CRITICAL CONSTRAINT" from path 1. The AI sees two conflicting instructions and follows the wrong one.

3. **Travel Intel** only renders ONE `TravelIntelCard` component in `TripDetail.tsx` using `trip.destination` (first city only).

4. **Missing leg detection** exists in the edge function prompt but the itinerary generator doesn't prevent fabricated flight cards for legs that don't exist.

## Solution — 4 Files, Targeted Changes

### Change 1: `getFlightHotelContext()` — Use flight intelligence arrival time when available

**File**: `supabase/functions/generate-itinerary/index.ts` (lines ~2796-2850)

After computing `outboundArrival` from `flight_selection`, check `flight_intelligence.destinationSchedule` for the first destination's `availableFrom`. If it exists, **override** the computed arrival time and earliest activity time with the intelligence data. This way the correct PMI 18:25 arrival (plus buffer) takes precedence over the MAD 12:15 layover arrival.

```text
// After line ~2850, before the constraints are built:
// Check flight_intelligence for a more accurate arrival (handles layover connections)
const flightIntel = trip.flight_intelligence as Record<string, unknown> | null;
if (flightIntel) {
  const schedule = flightIntel.destinationSchedule as Array<Record<string, unknown>> | undefined;
  const firstDest = schedule?.find(d => d.isFirstDestination);
  if (firstDest?.availableFrom) {
    // Flight intelligence knows about layovers — use its time instead
    const intelAvailable = firstDest.availableFrom as string; // ISO datetime
    const intelTime = intelAvailable.includes('T') ? intelAvailable.split('T')[1]?.substring(0, 5) : null;
    if (intelTime) {
      arrivalTime24 = normalizeTo24h(intelTime) || arrivalTime24;
      earliestFirstActivity = intelTime; // Already includes buffer from intelligence
      // Update arrivalTimeStr for display
      const arrivalDt = firstDest.arrivalDatetime as string | null;
      if (arrivalDt?.includes('T')) {
        arrivalTimeStr = arrivalDt.split('T')[1]?.substring(0, 5) || arrivalTimeStr;
      }
      console.log(`[FlightContext] Overridden by flight intelligence: arrival=${arrivalTimeStr}, earliest=${earliestFirstActivity}`);
    }
  }
  // Similarly for last destination departure
  const lastDest = schedule?.find(d => d.isLastDestination);
  if (lastDest?.availableUntil) {
    const intelUntil = lastDest.availableUntil as string;
    const untilTime = intelUntil.includes('T') ? intelUntil.split('T')[1]?.substring(0, 5) : null;
    if (untilTime) {
      latestLastActivity = untilTime;
      console.log(`[FlightContext] Last day overridden by intelligence: latest=${latestLastActivity}`);
    }
  }
}
```

### Change 2: Missing leg warning in itinerary prompt — prevent fabricated flights

**File**: `supabase/functions/generate-itinerary/prompt-library.ts` (lines ~1945-1956)

Strengthen the missing leg instruction to explicitly ban fabricating flight cards:

```text
// In the MISSING LEG HANDLING section, add:
missingLines.push(`DO NOT create or fabricate flight activity cards for this leg. Instead:`);
missingLines.push(`- Add a "Travel Day" note: "Flight not yet booked — ${leg.fromCity} to ${leg.toCity}"`);
missingLines.push(`- Show a warning banner, not a fake flight card`);
missingLines.push(`- Keep the travel day flexible with minimal scheduling`);
```

### Change 3: Travel Intel for ALL cities in multi-city trips

**File**: `src/pages/TripDetail.tsx` (lines ~1469-1478)

Replace the single `TravelIntelCard` with a loop over all trip cities when it's a multi-city trip:

```text
// Instead of one TravelIntelCard with trip.destination:
{tripCities.length > 1 ? (
  tripCities.map((city, i) => (
    <TravelIntelCard
      key={city.id}
      city={city.city_name}
      country={city.country || trip.destination_country || ...}
      startDate={city.arrival_date || trip.start_date}
      endDate={city.departure_date || trip.end_date}
      travelers={trip.travelers || 2}
      archetype={...}
      interests={...}
      className="mb-4"
    />
  ))
) : (
  <TravelIntelCard city={trip.destination} ... />  // existing single-city
)}
```

### Change 4: Add server-side layover validation as a safety net

**File**: `supabase/functions/parse-booking-confirmation/index.ts` (after line ~356, after segment sorting)

Add a deterministic post-processing step that validates the AI's layover classification. Even if the AI misses a layover, this catches it:

```text
// After sorting segments, validate layover detection:
if (parsedBooking.segments && parsedBooking.segments.length > 1) {
  for (let i = 0; i < parsedBooking.segments.length - 1; i++) {
    const current = parsedBooking.segments[i];
    const next = parsedBooking.segments[i + 1];
    // If current arrives at the same airport next departs from
    if (current.destination_code && next.origin_code && 
        current.destination_code === next.origin_code) {
      // Check time gap < 6 hours
      const arrivalMins = timeToMinutes(current.end_time);
      const departureMins = timeToMinutes(next.start_time);
      // Handle overnight by checking date too
      const sameDay = current.end_date === next.start_date;
      const gap = sameDay ? departureMins - arrivalMins : (departureMins + 1440) - arrivalMins;
      if (gap > 0 && gap < 360) { // Under 6 hours
        current.isLayoverArrival = true;
        // Group them
        const group = current.connectionGroup || next.connectionGroup || (i + 1);
        current.connectionGroup = group;
        next.connectionGroup = group;
      }
    }
  }
}
```

Add a helper `timeToMinutes` function at the top of the file.

## What Each Bug Fix Maps To

| Bug | Fix |
|-----|-----|
| Bug 1: Wrong arrival time (MAD layover used as PMI arrival) | Change 1 — intelligence override in getFlightHotelContext |
| Bug 2: Hotel check-in during layover | Change 1 — correct earliest activity time cascades to hotel timing |
| Bug 3: Fabricated missing flight cards | Change 2 — explicit ban in prompt + missing leg handling |
| Bug 4: Boston layover not detected | Change 4 — server-side validation catches AI misses |
| Bug 5: Travel Intel only covers first city | Change 3 — render TravelIntelCard per city |
| Bug 6: Trip date mismatch | Change 1 — intelligence data includes correct date range; existing mismatch banner already handles UI warning |

## Files Modified

1. `supabase/functions/generate-itinerary/index.ts` — Override arrival/departure times with flight intelligence data
2. `supabase/functions/generate-itinerary/prompt-library.ts` — Strengthen missing leg instructions
3. `src/pages/TripDetail.tsx` — Render TravelIntelCard per city for multi-city trips
4. `supabase/functions/parse-booking-confirmation/index.ts` — Server-side layover validation safety net

