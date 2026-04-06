
Fix Palácio Ludovice Checkout Address Regression

What I found
- This is very likely a checkout-specific pipeline gap, not a generic hotel bug.
- `pipeline/compile-day-schema.ts` includes hotel addresses on arrival/check-in examples, but many departure-day checkout examples only include the hotel name, not the address. That makes checkout the only hotel card with a weak address anchor.
- `pipeline/repair-day.ts` normalizes accommodation titles, but it does not consistently normalize hotel addresses.
- On hotel-change days, the injected checkout card currently uses a blank address instead of `previousHotelAddress`.
- The best full-trip enforcement point is `action-generate-trip-day.ts`, because that file already has `updatedDays` for the whole trip right before saving.

Implementation plan

1. Strengthen checkout prompt/schema guidance
File: `supabase/functions/generate-itinerary/pipeline/compile-day-schema.ts`
- Update departure-day checkout examples so hotel checkout cards include both:
  - `location.name`
  - `location.address`
- Add an explicit rule that all hotel logistics cards (`Check-in`, `Checkout`, `Freshen Up`, `Return to`, `Luggage Drop`) must reuse the exact hotel address from context and must never invent or vary the street number.

2. Add an exact hotel-address rule to the main AI prompt
File: `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`
- Add a hotel-address rule stating:
  - all hotel activities must use the exact hotel address from context
  - on hotel-change days, pre-checkout hotel cards use `resolvedPreviousHotelAddress`
  - post-checkin hotel cards use the active hotel address
- Add the requested Palácio Ludovice override when relevant:
  - `Palácio Ludovice Wine Experience Hotel: R. de São Pedro de Alcântara 39, 1250-238 Lisboa`
  - require that exact address for every card at that hotel

3. Fix same-day repair behavior
File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`
- Fix the hotel-change checkout injection so it uses `previousHotelAddress` instead of a blank address.
- Extend accommodation normalization so it also normalizes address fields, not just titles.
- For each accommodation card, choose the correct hotel address based on context:
  - before checkout on hotel-change days: previous hotel address
  - after checkout / normal stay: active hotel address
- Apply the corrected address to `location.address` and mirrored address fields if present.
- Add a targeted log when an accommodation address is corrected.

4. Add a trip-wide safety net after all days are assembled
File: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- After `updatedDays` is built and before saving `partialItinerary`, run a hotel address consistency pass across the full trip snapshot.
- Build a canonical hotel-address map using:
  1. hotel selection data as the source of truth
  2. observed hotel activities as fallback only when needed
- Match hotel-related accommodation cards by normalized hotel name and enforce one canonical address for each hotel across:
  - `Check-in`
  - `Checkout`
  - `Freshen Up`
  - `Return to`
  - `Luggage Drop` if present
- Log corrections with `HOTEL ADDRESS CONSISTENCY FIX`.

Technical notes
- I would not put the main consistency logic in `sanitization.ts`, because it only sees one day at a time.
- I would not change how check-in/checkout cards are created; this keeps the existing generation flow intact and adds repair/consistency layers around it.
- The highest-confidence address source should be the hotel selection data, not majority vote alone.

Verification
- Generate a 4-day Lisbon trip with Palácio Ludovice as the second hotel.
- Confirm every Palácio Ludovice accommodation activity shows the same address.
- Confirm the address is exactly `R. de São Pedro de Alcântara 39, 1250-238 Lisboa`.
- Confirm checkout never shows `29`, `24`, blank, or another variant.
- Check console for hotel-address correction logs.
