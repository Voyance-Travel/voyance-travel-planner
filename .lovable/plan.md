

## Remaining Issues: Backend Hotel Context Flattening

The frontend save/patch paths are now fixed, but the **backend AI prompt builder** (`getFlightHotelContext`) still has the same `hotel_selection[0]` flattening bug. This means the AI generates itinerary content with the wrong hotel context even when the data is correctly stored.

### Issue 1: Multi-city hotel context only uses first hotel per city

**File: `supabase/functions/generate-itinerary/flight-hotel-context.ts` (line 382)**

The `extractHotel` helper always returns `hs[0]` from each city's `hotel_selection` array. If a city has a split stay (two hotels), only the first is passed to the AI prompt. The AI then generates all days in that city referencing the wrong hotel for the second half of the stay.

**Fix:** When a city has multiple hotels in its `hotel_selection`, include all of them in the prompt context — similar to the split-stay logic already implemented for `trips.hotel_selection` (lines 348-359). Build a per-city split-stay schedule and append it to the AI prompt.

### Issue 2: Multi-city path doesn't populate `splitStayHotels` array

**File: `supabase/functions/generate-itinerary/flight-hotel-context.ts` (lines 371-406)**

The multi-city fallback (line 371) sets `hotel` and `hotelName` from the first city's first hotel, but never populates `splitStayHotels`. This means the split-stay prompt block (line 359) is never emitted for multi-city trips, even when cities have multiple hotels. The `compile-day-facts.ts` downstream also only sees one `hotelName`, so per-day hotel resolution in the prompt is lost.

**Fix:** After collecting all city hotels, if any city has multiple entries in `hotel_selection`, populate `splitStayHotels` from all cities' hotels (with date ranges from city arrival/departure dates) so the split-stay prompt block fires.

---

### Implementation Summary

| File | Change |
|---|---|
| `supabase/functions/generate-itinerary/flight-hotel-context.ts` (line 381-401) | Update `extractHotel` to return all hotels per city. When any city has multiple hotels, build a combined split-stay schedule and emit the split-stay prompt block. Populate `splitStayHotels` so downstream code resolves the correct hotel per day. |

