
Fix the hotel issue by addressing the actual remaining breakpoints, not just the schema text.

1. Remove the legacy hotel-stripper that is still deleting hotel placeholders
- Update `supabase/functions/generate-itinerary/sanitization.ts` so `stripPhantomHotelActivities()` no longer removes generic accommodation cards like:
  - `Your Hotel`
  - `Check-in at Your Hotel`
  - `Freshen up at Your Hotel`
  - `Return to Your Hotel`
  - generic checkout/check-in cards
- Only strip clearly fabricated specific hotel names when no hotel is booked.
- This same legacy stripper is still being called from:
  - `action-generate-day.ts`
  - `action-generate-trip-day.ts`
  - `generation-core.ts`
- Right now that safety-net is undoing the newer validator/repair logic.

2. Align “has hotel” detection with actual product rules
- Replace the narrow checks like `!!cityInfo?.hotelName` / `!!flightContext.hotelName` with the broader accommodation-presence logic already used elsewhere:
  - selected hotel
  - accommodation notes / parsed metadata
  - existing accommodation activities already in itinerary
- This prevents the system from treating “hotel exists but not formally selected” as “no hotel exists”.

3. Preserve multiple accommodation cards during regeneration
- Update frontend dedup logic in:
  - `src/services/itineraryActionExecutor.ts`
  - `src/components/itinerary/EditorialItinerary.tsx`
  - `src/components/itinerary/ItineraryEditor.tsx`
- Current logic keeps only one accommodation card and removes the rest, which wipes out:
  - midday freshen-up
  - return-to-hotel
  - checkout
- Change this to deduplicate only true duplicates, while preserving the valid hotel sequence for the day.

4. Standardize hotel patch behavior for placeholder replacement
- Update `src/services/hotelItineraryPatch.ts` so it does not rename every accommodation card to the same check-in title.
- Preserve card intent:
  - check-in stays check-in
  - checkout stays checkout
  - freshen-up stays freshen-up
  - return stays return
- Only replace the hotel name/location with the real selected hotel.

5. Verify bookend guarantees still cover all day types
- Re-check `repair-day.ts` against:
  - day 1
  - standard full day
  - last day
  - city transition day
- Ensure the final guaranteed shape is:
  - arrival/check-in on entry days
  - freshen-up / return-to-hotel on full days
  - checkout on departure days
- Keep `Your Hotel` as the single placeholder when no specific hotel is selected.

Expected outcome
- Hotel always exists as a base in the itinerary, even before selection.
- Placeholder hotel cards stop getting stripped later in the pipeline.
- Regeneration/edit flows stop collapsing hotel logic to a single card.
- Adding a real hotel updates all placeholder hotel cards consistently without turning every one into “Check-in”.

Technical notes
- The main bug is not just in `compile-day-schema.ts`.
- The biggest remaining blockers are:
  1. `stripPhantomHotelActivities()` in `sanitization.ts` still removes all accommodation cards when no hotel exists.
  2. Frontend regeneration sanitizers only preserve one accommodation card.
- Those two layers explain why the issue keeps appearing even after previous “fixes.”
