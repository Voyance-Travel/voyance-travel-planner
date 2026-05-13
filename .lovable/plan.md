## Diagnosis

The trip's `hotel_selection` is literally storing the wrong property:

```
name:    "The Ritz-Carlton, Laguna Niguel"
address: "One Ritz Carlton Dr, Dana Point, CA 92629, USA"
placeId: "ChIJ16OptRTw3IAR17XzKe_9RMI"   ← Laguna Niguel CA
trip.destination: "San Juan"
```

Every itinerary card that mentions the hotel (check-in, freshen-up, return, checkout, payments) renders this address verbatim. It survives refresh because the bad data is on `trips.hotel_selection`, not in `itinerary_data`.

Two upstream paths produce this:

1. **`enrichHotelByName(name, destination)`** in `supabase/functions/hotels/index.ts:679` queries Google Places with `${hotelName} ${destination}`. When the name already contains a foreign city ("…, Laguna Niguel"), that token dominates the search and Google returns the California property. There is no country/destination sanity check on the result before we store `placeId` / `address`.
2. **`normalizeLegacyHotelSelection`** stamps `id: 'migrated-…'` and accepts whatever `name` + `address` was passed in. No validation that the address belongs to the trip destination.

Result: brand resolution is correct, geographic resolution is broken, and there is no guard that catches the mismatch.

## Fix Plan

Three layers of defense plus a one-shot data correction. Mirrors the existing "Cross-City Fallback Integrity" / `detectCountryMismatch` pattern used elsewhere in the pipeline.

### 1. Scope hotel enrichment to the destination (backend)

`supabase/functions/hotels/index.ts` — `enrichHotelByName`:

- Pre-strip foreign-city tokens from the input `hotelName` before querying. Use shared `detectCountryMismatch(name, destination)` + a sibling-city scan (re-use `crossCityFilter`/`address-city-resolve`) to detect when the name itself names another locale; if found, query with `${brandStem} ${destination}` instead of `${nameAsIs} ${destination}` (e.g. "Ritz-Carlton San Juan" not "Ritz-Carlton Laguna Niguel San Juan").
- After Google returns a result, **validate** `place.formattedAddress` against the trip destination using `detectCountryMismatch` and an in-country city check. If the result is in the wrong country/city, return `{ success: false, reason: 'destination_mismatch', candidate: {...} }` instead of writing it.
- Same guard in `autoEnrichHotels` (the bulk path used by `searchHotels`).

### 2. Validate at write time (frontend)

New helper `src/utils/hotelDestinationGuard.ts`:

- `validateHotelMatchesDestination(hotel, destination): { ok, reason }` — runs `detectCountryMismatch` on `address` AND a name-token check (rejects names like "X, Laguna Niguel" when destination is San Juan).

Wire into the three writers:
- `src/services/supabase/trips.ts` (any `hotel_selection` insert/update).
- `src/contexts/TripPlannerContext.tsx` save path (line ~288).
- `src/components/trip/TripConfirmationBanner.tsx` confirm path (line ~126).

If validation fails: drop `address` / `placeId` / `website` / `images` (keep brand name + dates), trigger re-enrichment scoped to destination, and surface a toast explaining the mismatch so the user can pick the right property.

### 3. Self-heal already-bad trips

One-shot edge function `repair-hotel-destination` (or a small admin script) that, for trips where `hotel_selection.address` fails `detectCountryMismatch(addr, destination)`:
- Strip stale address/placeId/website/images/googleMapsUrl from `hotel_selection`.
- Call the patched `enrichHotelByName(brandStem, destination)`; if it returns a destination-matching result, write it back; otherwise leave only the brand name + dates flagged `needsHotelPick`.
- Then call `patchItineraryWithMultipleHotels` (already exists in `src/services/hotelItineraryPatch.ts`) so every accommodation card (check-in, luggage drop, freshen-up, return, checkout) re-renders with the corrected address.

Run this once for trip `fea55309-9708-448e-b105-19b712d533ca` immediately to clear the user's current symptom.

### 4. Tests

- `supabase/functions/hotels/__tests__/enrich-destination-guard.test.ts`: "Ritz-Carlton, Laguna Niguel" + dest "San Juan" → either re-queried as "Ritz-Carlton San Juan" or rejected with `destination_mismatch`.
- `src/utils/__tests__/hotelDestinationGuard.test.ts`: country mismatch + sibling-city mismatch + happy-path cases.

### Out of scope

- Itinerary generation prompt (the data flowing in is wrong; fixing the source fixes every card).
- Hotel UI/search affordances beyond the validation toast.
- Cost reconciliation (totalPrice stays as user entered).

### Memory

Add `mem://constraints/hotel/destination-resolution-guard` capturing the rule: "Hotel enrichment + write paths MUST verify the resolved address sits in the trip destination's country/city; mismatches are rejected, not stored." Index entry under Core.

Files to touch:
- `supabase/functions/hotels/index.ts`
- `supabase/functions/_shared/address-city-resolve.ts` (export sibling-city helper if not already)
- `src/utils/hotelDestinationGuard.ts` (new)
- `src/utils/hotelValidation.ts` (call guard in normalize)
- `src/services/supabase/trips.ts`
- `src/contexts/TripPlannerContext.tsx`
- `src/components/trip/TripConfirmationBanner.tsx`
- `supabase/functions/repair-hotel-destination/index.ts` (new, one-shot)
- Tests above
- `mem://index.md` + new constraint file
