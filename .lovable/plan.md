

## Remaining Gaps in Hotel/Itinerary Integration

### Gap 1: AddBookingInline always uses single-hotel patcher

**File: `src/components/itinerary/AddBookingInline.tsx` (line 964)**

When a hotel is added post-generation via the inline booking UI, it always calls `patchItineraryWithHotel` with just the new hotel — even when a `cityId` is present (multi-city path, line 913). This means adding Hotel B for City 2 overwrites Hotel A's cards in City 1.

**Fix:** After saving, if `cityId` is set, fetch all city hotels via `getTripCities` and call `patchItineraryWithMultipleHotels`. For single-city, check if `trips.hotel_selection` is an array with multiple entries and use the multi-hotel patcher accordingly.

### Gap 2: useSaveHotelSelection never uses multi-hotel patcher

**File: `src/services/supabase/trips.ts` (line 610)**

The `useSaveHotelSelection` hook always calls `patchItineraryWithHotel` with a single hotel. It has no awareness of whether other hotels exist on the trip. If a trip already has Hotel A saved and the user saves Hotel B via this hook, Hotel A's cards get overwritten.

**Fix:** After saving, fetch the current `trips.hotel_selection` array. If it contains multiple hotels, call `patchItineraryWithMultipleHotels` with all of them instead of patching just the one.

### Gap 3: PlannerHotelEnhanced manual entry ignores multi-city

**File: `src/pages/planner/PlannerHotelEnhanced.tsx` (line 706)**

Manual hotel entry always uses the single-hotel patcher, even when `isMultiCity && multiCityCityId` is true (line 683 confirms it saves to `trip_cities`). The multi-city fetch-and-patch logic from the search/selection path (line 554) is missing here.

**Fix:** Mirror the multi-city logic from line 554: fetch all city hotels and use `patchItineraryWithMultipleHotels` when multiple hotels exist.

---

### Implementation Summary

| File | Change |
|---|---|
| `src/components/itinerary/AddBookingInline.tsx` | Import `patchItineraryWithMultipleHotels` and `getTripCities`. After hotel save, if `cityId` exists, fetch all city hotels and use multi-hotel patcher. |
| `src/services/supabase/trips.ts` | In `useSaveHotelSelection`, after saving, fetch the trip's full `hotel_selection` array. If multiple hotels, call `patchItineraryWithMultipleHotels`. |
| `src/pages/planner/PlannerHotelEnhanced.tsx` | In the manual entry handler (~line 700), when `isMultiCity && multiCityCityId`, fetch all city hotels and use the multi-hotel patcher instead of single-hotel. |

These are the last three save paths still using the single-hotel patcher in multi-hotel scenarios. After these fixes, every hotel save path will correctly scope patches by date range.

