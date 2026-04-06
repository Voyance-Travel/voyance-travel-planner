
Goal
- Fix the persistent Miradouro phantom pricing by targeting the real remaining failure points: parser/display drift plus a small hardening pass on the backend matcher/logging.

What I verified in the code
- `ALWAYS_FREE_VENUE_PATTERNS` already exists in `supabase/functions/generate-itinerary/sanitization.ts`.
- It is already used in the active backend flow:
  - `sanitization.ts` via `checkAndApplyFreeVenue(...)`
  - `action-repair-costs.ts`
  - `generation-core.ts`
- The sanitization check is wired into the generation pipeline, and the later cross-day pricing pass in `action-generate-trip-day.ts` only normalizes dining prices, so it is not the Miradouro overwrite.
- The biggest concrete gap I found is frontend parsing:
  - `src/utils/itineraryParser.ts` drops numeric `0` because `parseCost()` returns `undefined` for falsy values.
  - it also does not normalize top-level `estimated_price_per_person` / `price_per_person`.
  - that can erase backend zeroes and send the UI back into estimation paths.
- I also want to harden `checkAndApplyFreeVenue(...)` so its debug logging reads cost fields consistently when `estimatedCost` is an object.

Implementation plan
1. Harden the backend free-venue helper
- Keep `ALWAYS_FREE_VENUE_PATTERNS` and the pattern list unchanged.
- Update `checkAndApplyFreeVenue(...)` to resolve cost from all supported shapes (`cost.amount`, numeric `cost`, `estimatedCost.amount`, numeric `estimatedCost`, `estimated_price_per_person`, `price`, `price_per_person`) so the `FREE VENUE CHECK` / `PHANTOM PRICING FIX` logs are trustworthy.
- Keep the existing title + venue matching and paid-experience exclusion.
- Add the explicit category candidate gate from the prompt only around the override logic, not around the shared pattern constant.

2. Preserve zero-valued prices in the parser
- Update `src/utils/itineraryParser.ts` so numeric `0` is treated as a valid parsed cost.
- Normalize top-level price fields into the parsed activity shape instead of losing them when only root-level fields are present.
- Preserve venue metadata needed by frontend free detection.

3. Make the itinerary UI trust normalized zeroes before estimating
- Update `getActivityCostInfo(...)` in `src/components/itinerary/EditorialItinerary.tsx` to read the normalized parsed price fields before falling back to estimation.
- Keep `isLikelyFreePublicVenue(...)` as the safety net so Miradouro/Jardim still render as Free even on older inconsistent trip records.

4. Reconfirm ledger sync protection
- Recheck the existing sync guards in `EditorialItinerary`, `usePayableItems.ts`, and assistant sync so free venues never re-write positive `activity_costs`.
- Ensure stale paid rows for activities now treated as free are cleaned out so itinerary cards, Payments, and Budget all agree.

Files to update
- `supabase/functions/generate-itinerary/sanitization.ts`
- `src/utils/itineraryParser.ts`
- `src/components/itinerary/EditorialItinerary.tsx`
- likely `src/hooks/usePayableItems.ts` and `src/components/itinerary/ItineraryAssistant.tsx` for alignment only
- No new files expected.

Verification
- Generate a fresh 4-day Lisbon trip.
- Confirm any activity with `Miradouro` in title or venue metadata shows Free in:
  - itinerary cards
  - Payments tab
  - Budget totals
- Confirm `Jardim` venues also show Free unless `bookingRequired` is true.
- Confirm museums, tours, galleries, and booking-required items stay paid.
- Confirm edge logs show `FREE VENUE CHECK` / `PHANTOM PRICING FIX`.
- Confirm the stored trip data and `activity_costs` both end at zero for the matched free venue.

Technical note
- Based on the current codebase, the most likely issue is no longer “the backend check is missing.” It is “backend zeroes are not being preserved consistently through parsing, display, and reconciliation.” This plan fixes that path without changing the free-venue pattern list.
