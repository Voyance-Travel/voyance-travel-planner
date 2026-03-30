

## ✅ Completed: Venue-Meal Mismatch After Relabeling
Implemented venue-appropriateness checks and swap logic in repair-day.ts and day-validation.ts.

## ✅ Completed: Return Home Card Reflects Step 2 Transport Mode

### Changes Made

**`src/services/itineraryAPI.ts`** — `buildDayCityMap()`
- Last day of the last city is now marked `isDepartureDay: true` with `departureTo: '__home__'`
- Picks up transport type/details from the last city's `trip_cities` record

**`src/components/itinerary/EditorialItinerary.tsx`** — Final departure card
- Condition expanded: fires when `flightSelection` exists OR when `isDepartureDay` with `__home__` target
- Non-flight returns (train, ferry, car, bus) now build a proper InterCityTransportCard with correct icon, mode label, and category
- Falls back to `originCity` prop for the "to" destination when no airport data exists

**`supabase/functions/generate-itinerary/pipeline/repair-day.ts`** — Step 8b
- Generic fallback now checks `nextLegTransport` to produce mode-specific labels (e.g., "Transfer to the Station" for trains, "Transfer to the Ferry Terminal" for ferries)
