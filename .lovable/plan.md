


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

## ✅ Completed: Hotel → Itinerary Date-Aware Patching

### Changes Made

**`src/services/hotelItineraryPatch.ts`** — Date-aware patching
- `patchItineraryWithHotel` now scopes patches to days within `checkInDate`/`checkOutDate` range
- New export `patchItineraryWithMultipleHotels` handles batch patching with per-hotel date scoping
- Backward compatible: omitting dates patches all days as before

**`src/utils/injectHotelActivities.ts`** — Transition-day drop-bags logic
- `injectMultiHotelActivities` detects transition days (Hotel A checkout + Hotel B check-in same date)
- Injects "Drop bags at [Hotel B]" card at 12:00 with 30-min duration between checkout and check-in
- Deterministic IDs (`hotel-dropbags-{id}`) for idempotent re-injection

**`src/pages/planner/PlannerHotelEnhanced.tsx`** — All 3 save paths now pass `checkInDate`/`checkOutDate`
**`src/components/itinerary/FindMyHotelsDrawer.tsx`** — Passes `startDate`/`endDate` as date params
**`src/components/itinerary/AddBookingInline.tsx`** — Already passed dates (no change needed)
**`src/services/supabase/trips.ts`** — `useSaveHotelSelection` passes dates via flexible field access
