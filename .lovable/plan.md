

## Fix: Inject Flight Card on Last Day Even Without Explicit Flight Time

### Problem
On the last day, when no explicit return flight time is stored (`returnDepartureTime24` is empty), the repair pipeline still injects a "Transfer to Airport" card (line 902 fallback branch), but the flight card injection at line 956 is gated by `isLastDay && returnDepartureTime24`. This means the itinerary ends with a transport card going to the airport — and nothing after it. No airport arrival, no flight.

### Fix

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

Expand the flight card injection block (line 955-989) to also fire when `isLastDay` and a departure transport card targeting an airport exists, even if `returnDepartureTime24` is missing:

1. Change the guard from `isLastDay && returnDepartureTime24` to `isLastDay`
2. When `returnDepartureTime24` is available, use it for exact timing (existing logic)
3. When `returnDepartureTime24` is missing, derive the flight time from the airport transfer card's end time + a reasonable buffer (e.g., 2 hours for check-in/security), and create a generic "Departure Flight" card
4. Only inject if there's actually an airport-bound transport card (don't inject flight cards on non-airport departure days like train departures)

```
// Pseudocode for the expanded logic:
if (isLastDay) {
  const hasFlightCard = activities.some(a => cat === 'flight' || title includes 'flight departure');
  
  if (!hasFlightCard) {
    const airportTransport = activities.find(a => transport to airport);
    if (airportTransport) {
      const depMins = returnDepartureTime24 
        ? parseTimeToMinutes(returnDepartureTime24)
        : (parseTimeToMinutes(airportTransport.endTime) + 120); // 2hr after arriving at airport
      
      // inject flight card at depMins
    }
  }
}
```

### Expected behavior
- Last day always shows: ... → Transfer to Airport → Departure Flight
- With flight data: exact flight time is used
- Without flight data: flight card placed ~2 hours after airport transfer arrival

### Files changed
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — expand flight card guarantee to work without explicit departure time

