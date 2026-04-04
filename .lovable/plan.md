

## Fix: Inject Default Arrival Flight When No Flight Data Exists

### Problem
When `flight_selection` is null, `arrivalTime24` is undefined throughout the pipeline. This means:
- The schema compiler (compile-day-schema.ts line 301-329) tells the AI to start Day 1 at 10:00 AM with just a check-in — no arrival narrative
- The repair pipeline (repair-day.ts line 301) skips arrival flight + airport transfer injection because `arrivalTime24` is falsy

Result: Day 1 starts abruptly with hotel check-in at 10:00 AM, with no travel context.

### Fix

**File: `supabase/functions/generate-itinerary/action-generate-day.ts`** — where `arrivalTime24` is assigned to `validationInput` (line ~804)

Add a default morning arrival time (`"09:00"`) when it's Day 1 and no flight data exists. This single change flows through to both validation and repair, which will then inject the "Arrival Flight" + "Airport Transfer" cards automatically.

**File: `supabase/functions/generate-itinerary/pipeline/compile-day-schema.ts`** — the no-flight Day 1 branch (lines 301-329)

Update the prompt to include an arrival sequence instead of starting cold at 10:00 AM. Use a default 09:00 arrival time, with "Arrival" + "Transfer to Hotel" + "Check-in" sequence starting at 09:00.

### Specific Changes

**action-generate-day.ts** (~line 804):
```
Before:
  arrivalTime24: flightContext.arrivalTime24,

After:
  arrivalTime24: flightContext.arrivalTime24 || (isFirstDay ? '09:00' : undefined),
```

**compile-day-schema.ts** (lines 271-329) — the `} else {` no-flight branches:

Update both the "hotel but no flight" and "no hotel, no flight" branches to assume a 09:00 arrival and include Arrival + Transfer + Check-in in the prompt sequence, matching the structure of the flight-data branches.

### Impact
- Day 1 will always have an Arrival Flight card + Airport Transfer card, even without flight data
- The arrival card will show generic "Arrival Flight" (no airline/flight number) arriving at 09:00
- Airport transfer follows, then hotel check-in — creating a complete travel narrative
- No change when flight data exists (existing `arrivalTime24` takes precedence)

### Files
- `supabase/functions/generate-itinerary/action-generate-day.ts` — 1-line default
- `supabase/functions/generate-itinerary/pipeline/compile-day-schema.ts` — update no-flight Day 1 prompt branches

