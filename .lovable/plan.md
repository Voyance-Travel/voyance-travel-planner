

## Fix: Pass Per-City Hotel Data Through generate-trip-day Chain

### Problem
In multi-city trips, `getFlightHotelContext()` only returns the first city's hotel. When `generate-trip-day` chains into `generate-day` for City 2+, the AI gets City 1's hotel (or none), causing it to invent hotels.

### Changes (all in `supabase/functions/generate-itinerary/index.ts`)

**1. Add `hotel_selection` to trip_cities query** (line 10405)
- Add `hotel_selection` to the `.select()` call so per-city hotel data is available.

**2. Extract hotel from each city in the day map builder** (lines 10416-10423)
- Parse `hotel_selection` (which is stored as `[hotelObj]` array) and add `hotelName` and `hotelAddress` to each map entry.

**3. Pass hotel override + positional flags in generate-day call** (lines 10495-10513)
- Add `hotelOverride` object with `name`/`address` from `cityInfo`.
- Add `isFirstDayInCity` and `isLastDayInCity` booleans by comparing adjacent entries in `dayCityMap`.

**4. Destructure new params in generate-day handler** (line 6452-6455)
- Add `hotelOverride`, `isFirstDayInCity`, `isLastDayInCity` to the destructured params.

**5. Apply hotel override after flightContext load** (after line 7022)
- If `paramHotelOverride.name` exists, overwrite `flightContext.hotelName` and `flightContext.hotelAddress` so the prompt uses the correct per-city hotel.

### Impact
- Only affects the `generate-trip-day` → `generate-day` chain for multi-city trips
- Single-city trips and full Stage 2 generation are unaffected
- No database changes needed

