
# Fix: Account for Flight Duration When Determining Itinerary Start

## Problem
When a user departs at 10 PM on July 1st from the US to Europe, their itinerary currently starts on July 1st. But they won't land until July 2nd due to flight duration and timezone differences. The system blindly uses `trip.start_date` as Day 1 without checking the flight's actual arrival date.

## Root Cause
Two gaps in the current logic:

1. **`extractFlightData()` in `prompt-library.ts`** has `arrivalDate` and `departureDate` fields in its `FlightData` interface but never populates them from the flight selection data.

2. **`generate-itinerary/index.ts`** uses `context.startDate` (from `trip.start_date`) directly as Day 1 without comparing it against the flight's arrival date. If you depart July 1 at 10 PM and land July 2 at 1 PM, Day 1 should be July 2, not July 1.

## Solution

### 1. Extract arrival date in `extractFlightData()` (prompt-library.ts)
Populate the `arrivalDate` and `departureDate` fields from the flight selection legs. Pull from:
- `legs[].arrival.date` (new format)
- `departure.arrival.date` (legacy nested format)
- Parse from ISO datetime strings if available (e.g., `2026-07-02T13:00:00`)

### 2. Compare arrival date vs start date in `generate-itinerary/index.ts`
After building the generation context (~line 4007), add logic:
- If `flightData.arrivalDate` exists and is **after** `context.startDate`, treat Day 1 as a **departure/travel day** (flight-only, no destination activities)
- Shift the "real" itinerary activities to start on the arrival date
- Two approaches (use the simpler one):
  - **Option A (recommended)**: Keep `totalDays` the same, but mark Day 1 as a "Travel Day" via prompt constraints. Day 1 prompt gets: "Traveler is in transit. No destination activities. Only include: pack, travel to airport, board flight, in-flight rest."
  - **Option B**: Shift `context.startDate` to the arrival date and reduce `totalDays` by 1. This changes the itinerary window but may confuse users who set specific dates.

Going with **Option A** -- it preserves the user's chosen dates while making Day 1 a realistic travel day.

### 3. Inject "travel day" constraint into Day 1 prompt
In `generateSingleDayWithRetry()` (~line 4567), when `dayNumber === 1` and the flight departs on `startDate` but arrives on `startDate + 1`:
- Override the prompt to generate a **departure city travel day** instead of destination activities
- Activities: morning prep, travel to airport, boarding, in-flight (no destination sightseeing)
- The actual destination exploring starts on Day 2

### 4. Same logic for return flight (last day)
If the return flight's arrival date is after the trip end date, the last day should be a "travel day" at the destination (airport transfer + flight), not a full sightseeing day. This is partially handled already but needs the date comparison.

### 5. Update `cascadeTransportToItinerary.ts`
The cascade logic also needs to recognize when Day 1 is a departure-city travel day:
- If `leg.departure.date === startDate` and `leg.arrival.date > startDate`, don't try to schedule post-arrival activities on Day 1
- Instead, cascade arrival logistics to Day 2

## Files to Change

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/prompt-library.ts` | Populate `arrivalDate`/`departureDate` in `extractFlightData()` from legs data |
| `supabase/functions/generate-itinerary/index.ts` | Add arrival-date-vs-start-date comparison after context build; inject travel-day prompt for Day 1 when departure day != arrival day |
| `src/services/cascadeTransportToItinerary.ts` | Skip arrival cascade on Day 1 when arrival date is Day 2; apply arrival cascade to Day 2 instead |
| `src/utils/normalizeFlightSelection.ts` | No changes needed (already supports `arrival.date`) |

## Edge Cases Handled
- **No flight data**: No change to current behavior (Day 1 = start_date as usual)
- **Same-day arrival**: No change (e.g., domestic US flights landing same day)
- **Red-eye arriving next morning**: Day 1 becomes travel day, Day 2 starts with arrival logistics
- **Multi-leg with layover**: Uses the destination arrival leg's date (respects `isDestinationArrival` marker)
- **Manual entry without dates**: Falls back to current behavior (time-only scheduling)
