

## ✅ DONE: Fix Last Day in City Generates Airport Itinerary for Non-Flight Departures

Fixed in previous session. Non-flight departures (train/bus/ferry) now generate station-based logistics instead of airport activities.

## ✅ DONE: Fix Per-City Hotel Resolution in Single-Day Regeneration

Added `hotel_selection` to the `trip_cities` query in the transition resolver. After matching the current day to its city, the resolver now extracts the per-city hotel (with date-aware split-stay support) and sets `resolvedHotelOverride`. This ensures regenerated days use the correct hotel for that city, not the global trip hotel.
