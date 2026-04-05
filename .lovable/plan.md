
### What I found
- The first fix is already present: `compile-prompt.ts` tells the AI to use the previous hotel for breakfast on hotel-change days, and `repair-day.ts` already tries to rewrite pre-checkout dining.
- The bug is persisting because that safeguard is still too narrow:
  - the day is still broadly anchored to the new hotel as the active hotel for that date
  - the repair only fixes obvious cases and does not have the **previous hotel address**
  - the current repair fallback incorrectly writes `previousHotelName` into `location.address`, so location cleanup is incomplete

### Plan
1. **Carry previous-hotel address through the pipeline**
   - Extend the compiled facts and repair input to include `previousHotelAddress` alongside `previousHotelName`.
   - Populate it in `compile-day-facts.ts` for both:
     - multi-city split stays
     - single-city split stays
   - Pass it through `action-generate-day.ts` and the fallback repair call in `action-generate-trip-day.ts`.

2. **Make hotel-change-day instructions explicit**
   - In `compile-prompt.ts`, add a dedicated hotel-change-day instruction block for normal middle days:
     - morning starts at the **old** hotel
     - breakfast and any pre-checkout stop must be at/near the **old** hotel
     - nothing can happen at the **new** hotel before check-in
     - only after check-in should activities shift to the new hotel area
   - Keep the existing breakfast override, but strengthen it into a full required sequence:
     `Breakfast → Checkout → Transfer → Check-in`.

3. **Strengthen pre-checkout dining repair**
   - In `repair-day.ts`, inspect all dining activities before checkout on hotel-change days.
   - Rewrite any activity that points to the new hotel via:
     - title
     - generic hotel wording
     - location name
     - exact new-hotel address
   - Use the real previous hotel address when correcting location data.

4. **Add a validation guard**
   - In `validate-day.ts`, add a hotel-change-specific check that flags pre-checkout breakfast/dining tied to the new hotel.
   - This gives a deterministic safeguard in logs and helps prevent regressions.

### Technical details
- **Files to update**
  - `supabase/functions/generate-itinerary/pipeline/types.ts`
  - `supabase/functions/generate-itinerary/pipeline/compile-day-facts.ts`
  - `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`
  - `supabase/functions/generate-itinerary/pipeline/repair-day.ts`
  - `supabase/functions/generate-itinerary/pipeline/validate-day.ts`
  - `supabase/functions/generate-itinerary/action-generate-day.ts`
  - `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- **No changes to**
  - generation architecture
  - checkout/check-in banner logic
  - new files

### Verification
- Generate a Lisbon trip with a Day 3 split stay.
- Confirm Day 3 morning flow is:
  - breakfast at/near **Four Seasons Ritz**
  - checkout from **Four Seasons Ritz**
  - transfer
  - check-in at **Palácio Ludovice**
- Confirm Day 3 does **not** place breakfast at the new hotel or at a venue/address clearly tied to it before checkout.
- Regression check:
  - single-hotel trips still behave normally
  - post-check-in afternoon/evening still anchor to the new hotel
  - arrival/departure day behavior remains unchanged
