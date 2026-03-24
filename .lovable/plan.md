


## ✅ DONE: Fix Last Day in City Generates Airport Itinerary for Non-Flight Departures

Fixed in previous session. Non-flight departures (train/bus/ferry) now generate station-based logistics instead of airport activities.

## ✅ DONE: Fix Per-City Hotel Resolution in Single-Day Regeneration

Added `hotel_selection` to the `trip_cities` query in the transition resolver. After matching the current day to its city, the resolver now extracts the per-city hotel (with date-aware split-stay support) and sets `resolvedHotelOverride`. This ensures regenerated days use the correct hotel for that city, not the global trip hotel.

## ✅ DONE: Fix Multi-City Hotel + Non-Flight Departure Holes (Audit)

Fixed 3 backend holes in `generate-itinerary/index.ts`:

1. **Hole 1 (return flight leak)**: When `isNonFlightDeparture` is true, strip `returnDepartureTime` and LAST DAY TIMING CONSTRAINT text from flightContext to prevent prompt conflicts on train/bus departure days.

2. **Hole 2 (missing checkInDate)**: First hotel in split-stay arrays often lacks `checkInDate`. dayCityMap builder now defaults to `context.startDate`; transition resolver treats missing `checkInDate` as matching any date before `checkOutDate`.

3. **Hole 4 (hotel enforcement in regen)**: Added `🏨 ACCOMMODATION` + `🚫 CRITICAL` enforcement block to flightContext in the regeneration path for multi-city trips, mirroring the full-trip path's hotel name enforcement.

**Hole 3 (departureTime capture)** is a frontend builder enhancement — backlogged.

## ✅ DONE: Fix Split-Stay Date Inference + Departure Day Prompt (Audit Round 2)

Fixed 2 additional holes:

1. **Hole A (split-stay without dates)**: When split-stay hotels lack `checkInDate`/`checkOutDate`, the system now evenly distributes nights across hotels (e.g., 9 nights / 3 hotels = 3 nights each). Applied in both dayCityMap builder and transition resolver. Frontend fix to save dates properly is backlogged.

2. **Hole B ("Tomorrow" → "Today")**: Changed full-trip departure day overlay from "Tomorrow the traveler takes a TRAIN" to "The traveler departs TODAY by TRAIN". This aligns with the single-day regeneration path and prevents the AI from generating full sightseeing days on departure days.
