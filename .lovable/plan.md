

## Remaining Hotel/Itinerary Integration Gaps

### Gap 1: `patchItineraryWithMultipleHotels` is never called

The function was created in `hotelItineraryPatch.ts` but no save path uses it. When a multi-city trip saves hotels (from `booking-changed` handler in TripDetail.tsx, or from FindMyHotelsDrawer for multi-city), each hotel still calls `patchItineraryWithHotel` individually — meaning the last hotel overwrites all days. The `booking-changed` handler in TripDetail.tsx (line 3017-3027) uses `injectMultiHotelActivities` for card injection but never calls `patchItineraryWithMultipleHotels` to fix the title/address patches.

**Fix:** In the `booking-changed` handler (TripDetail.tsx ~line 3010), after injection, call `patchItineraryWithMultipleHotels` with all city hotels and their date ranges. Similarly, when `FindMyHotelsDrawer` saves a hotel for a multi-city trip, call the multi-hotel patcher with all known hotels instead of the single-hotel version.

### Gap 2: Single-city multi-hotel (split stays) only injects first hotel

TripDetail.tsx line 3032-3036: when `updatedCities.length <= 1`, it calls `injectHotelActivitiesIntoDays` with `hotels[0]` only. If a single-city trip has 2 hotels (split stay via `trips.hotel_selection` array), the second hotel's check-in/checkout cards are never injected.

**Fix:** When `hotels.length > 1`, call `injectMultiHotelActivities` instead of `injectHotelActivitiesIntoDays` — same as the multi-city path.

### Gap 3: Multi-city hotel patch in PlannerHotelEnhanced doesn't use multi-hotel patcher

Lines 553-558 in PlannerHotelEnhanced.tsx call `patchItineraryWithHotel` for a single hotel even in multi-city mode. If two cities each have a hotel saved, saving city B's hotel patches all days including city A's.

**Fix:** In multi-city mode, after saving the per-city hotel, fetch all city hotels and call `patchItineraryWithMultipleHotels` instead.

### Gap 4: "Freshen up" / "Return to hotel" cards not patched by date-aware logic

`patchItineraryWithHotel` correctly patches check-in/checkout titles, but it also patches midday "Freshen up at Your Hotel" and "Return to Your Hotel" cards. In a multi-hotel split stay, a Day 3 "Freshen up" should say Hotel B, not Hotel A. The date-aware scoping handles this correctly — but only if `patchItineraryWithMultipleHotels` is actually called (see Gap 1).

This is resolved by fixing Gap 1.

### Gap 5: Manual hotel entry in PlannerHotelEnhanced uses `checkIn`/`checkOut` times, not dates

Lines 693-698: `manualHotel.checkIn` and `manualHotel.checkOut` are set from `data.hotel.checkInTime` / `data.hotel.checkOutTime` — these are times (e.g., "15:00"), not dates. The patch receives times where it expects dates, so date scoping silently fails and patches all days.

**Fix:** Pass the trip's `startDate`/`endDate` as `checkInDate`/`checkOutDate` for manual single-hotel entries.

---

### Implementation Summary

| File | Change |
|---|---|
| `src/pages/TripDetail.tsx` (~line 3010) | After injection, call `patchItineraryWithMultipleHotels` for multi-city. For single-city with multiple hotels, use `injectMultiHotelActivities` instead of single-hotel inject. |
| `src/pages/planner/PlannerHotelEnhanced.tsx` (~line 553, ~line 693) | Multi-city: fetch all city hotels and call `patchItineraryWithMultipleHotels`. Manual entry: pass trip dates, not check-in/out times. |
| `src/components/itinerary/FindMyHotelsDrawer.tsx` | Multi-city: after saving, fetch all city hotels and call `patchItineraryWithMultipleHotels`. |

These are all wiring fixes — the core logic (`patchItineraryWithMultipleHotels`, `injectMultiHotelActivities`, date-aware scoping) already exists and works correctly. The problem is that the multi-hotel patcher is dead code that nothing calls.

