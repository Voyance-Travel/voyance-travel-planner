

## Fix: Single-Day Regeneration Doesn't Pick Up Per-City Hotel

### What Works Already
The non-flight departure logic (train/bus/ferry) **does work** for regeneration. The `generate-day` handler has a "Transition Day Resolver" (line 7447-7526) that queries `trip_cities` from the database and correctly resolves:
- `resolvedIsLastDayInCity` — triggers the non-flight departure prompt
- `resolvedNextLegTransport` — the actual transport mode (train, bus, etc.)
- `resolvedNextLegTransportDetails` — departure time, station, carrier

So regenerating the last day in a city will correctly produce train/bus departure logistics.

### What Doesn't Work
The **per-city hotel** is NOT resolved during single-day regeneration. Here's the gap:

1. `getFlightHotelContext()` (line 7924) fetches the **global** trip hotel from `trips.hotel_selection` — always the first hotel
2. `paramHotelOverride` (line 7927) is only set when the full-trip generation chain calls `generate-day` internally — the **frontend never passes it** during user-triggered regeneration
3. The transition resolver (line 7447-7526) resolves transport context from `trip_cities` but **never loads `hotel_selection`** from the matching city

Result: When you regenerate any day in a multi-city trip, it uses the wrong hotel (the global one instead of the per-city one).

### Fix — 1 file

**`supabase/functions/generate-itinerary/index.ts`**

**Inside the transition resolver block** (~line 7449-7526), after determining which city the current day belongs to, also load that city's `hotel_selection` and override `paramHotelOverride` with it:

1. Add `hotel_selection` to the `trip_cities` select query (line 7451)
2. After resolving `resolvedDestination` and `resolvedCountry` for the matched city (line 7463-7464), extract the hotel from that city's `hotel_selection`:
   - If `hotel_selection` is an array with date ranges, match against the day's date (reusing the date-aware logic from the full-trip path)
   - If it's a single hotel, use it directly
3. If a per-city hotel is found, set `paramHotelOverride = { name, address, ... }` so the existing override at line 7927 picks it up

This is a small, surgical change — ~15 lines inside the existing resolver block. No frontend changes needed since the backend already queries `trip_cities` during regeneration.

### Files
- `supabase/functions/generate-itinerary/index.ts` — add hotel resolution to the transition-day resolver in the `generate-day` handler

