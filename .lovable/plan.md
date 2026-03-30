

## Remaining Hotel Integration Issues

Two categories of issues remain: a flattening bug (same one fixed in TripDetail but not propagated) and missing multi-hotel checks in single-city paths.

### Issue 1: `hotel_selection[0]` flattening in PlannerHotelEnhanced and FindMyHotelsDrawer

**PlannerHotelEnhanced.tsx (line 558)** and **FindMyHotelsDrawer.tsx (line 242)** both use `.map` with `hotel_selection[0]` when collecting city hotels for multi-hotel patching. If a city has a split stay (array of 2+ hotels), only the first is included. This was already fixed in TripDetail with `.flatMap` but not propagated to these two files.

**Fix:** Replace `.map` + `hotel_selection[0]` with `.flatMap` over the full array in both files.

### Issue 2: Single-city paths missing multi-hotel state check

**FindMyHotelsDrawer.tsx (line 253):** The single-city fallback always calls `patchItineraryWithHotel` with just the selected hotel, ignoring any existing hotels in `trips.hotel_selection`.

**AddBookingInline.tsx (line 988):** Same issue — single-city path patches with just the new hotel without checking for existing multi-hotel state.

**Fix:** In both single-city paths, fetch `trips.hotel_selection`. If it contains multiple hotels, use `patchItineraryWithMultipleHotels` instead.

---

### Implementation Summary

| File | Change |
|---|---|
| `src/pages/planner/PlannerHotelEnhanced.tsx` (line 557) | Replace `.map` + `hotel_selection[0]` with `.flatMap` over the full array |
| `src/components/itinerary/FindMyHotelsDrawer.tsx` (line 241) | Replace `.map` + `hotel_selection[0]` with `.flatMap` over the full array |
| `src/components/itinerary/FindMyHotelsDrawer.tsx` (line 253) | Fetch `trips.hotel_selection`, use multi-hotel patcher if multiple entries |
| `src/components/itinerary/AddBookingInline.tsx` (line 988) | Fetch `trips.hotel_selection`, use multi-hotel patcher if multiple entries |

