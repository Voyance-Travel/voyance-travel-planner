

## Add Flight & Transport Cards to the Itinerary

### Problem
Flight details from Step 2 are passed through the pipeline but only used as **timing constraints** — they never appear as visible activity cards. On Day 1, the traveler just magically appears at the hotel. On inter-city travel days, there's a "Transfer to Station" but no card showing the actual journey.

### What We'll Add

**Day 1 (Arrival Day) — inject two cards before check-in:**
1. **"Arrival Flight"** card — category `flight`, showing the flight landing time, departure/arrival airports from `flight_selection`
2. **"Airport Transfer to Hotel"** card — category `transport`, from arrival airport to hotel, using `airportTransferMinutes` for duration

**Inter-city departure days — inject the journey card after the station/airport transfer:**
3. **Journey card** (e.g., "Flight to Rome" or "Train to Kyoto") — using `nextLegTransport` and `nextLegTransportDetails` to populate carrier, departure time, and duration

### Fix Location

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

#### 1. Arrival Flight + Airport Transfer (after Step 3, chronology filter)
- Only on `isFirstDay` when `arrivalTime24` exists
- Check if an arrival flight card already exists (guard against duplicates)
- Inject:
  - **Arrival Flight**: startTime = `arrivalTime24`, duration ~2hr (or from flight data), category `flight`, location = arrival airport name
  - **Airport Transfer**: startTime = flight endTime, duration = `airportTransferMinutes` (from compile-day-facts, default 45min), category `transport`, fromLocation = airport, location = hotel
- These go *before* the check-in card

#### 2. Inter-city Journey Card (after Step 8b, departure transport guarantee)
- Only on `isLastDayInCity && !isLastDay` when `nextLegTransport` exists
- Check if a journey card already exists
- Inject after the station/airport transfer:
  - Title: "Flight to {nextLegCity}" / "Train to {nextLegCity}"
  - startTime from `nextLegTransportDetails.departureTime` or after the transfer card ends
  - Duration from transport details or defaults (flight: 2hr, train: 3hr, bus: 4hr)
  - Category: `flight` for flights, `transport` for train/bus/ferry

### Data Already Available
All needed data is already in `RepairDayInput`:
- `arrivalTime24`, `departureAirport` — from flight context
- `airportTransferMinutes` — from compile-day-facts (needs to be added to RepairDayInput)
- `nextLegTransport`, `nextLegTransportDetails`, `nextLegCity` — already passed through

### Files Changed
- `supabase/functions/generate-itinerary/pipeline/types.ts` — add `arrivalAirport` and `airportTransferMinutes` to RepairDayInput if missing
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — inject arrival flight + airport transfer on Day 1; inject journey card on inter-city days
- `supabase/functions/generate-itinerary/action-generate-day.ts` — pass `arrivalAirport` and `airportTransferMinutes` to repair input

