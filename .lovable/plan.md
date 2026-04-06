
Goal

- Close the remaining phantom-pricing drift. The backend “always free venue” rule is already in place; the remaining mismatch appears to be on the frontend/UI and client-side ledger sync paths.

What I found

- `ALWAYS_FREE_VENUE_PATTERNS` already exists in `supabase/functions/generate-itinerary/sanitization.ts`.
- It is already being used in:
  - `sanitization.ts` via `checkAndApplyFreeVenue(...)`
  - `action-repair-costs.ts`
  - `generation-core.ts`
- `action-generate-trip-day.ts` already runs `handleRepairTripCosts(...)` after final table sync, so the backend rule already runs last in the generation chain.
- Current trip data for `e6e4ac6b-5dfc-4b72-9016-fde0cde28913` shows `Scenic Views at Miradouro de São Pedro de Alcântara` with zero cost in itinerary JSON, so the backend fix is active.
- The remaining gap is frontend detection:
  - `src/components/itinerary/EditorialItinerary.tsx` checks free venues using title/location/address/description, but not `venue_name` or `restaurant.name`.
  - `src/hooks/usePayableItems.ts` passes even less context to the free-venue helper.
- That means a case where “Miradouro” exists only in `venue_name` can still look paid in UI surfaces even if the backend already sanitized it.
- There is also a client-side cost sync path (`syncBudgetFromDays`, plus similar assistant sync code) that writes positive `activity_costs` rows from activity cost fields. That path should explicitly respect free-venue detection so client reconciliation cannot reintroduce phantom pricing.

Implementation plan

1. Expand the frontend free-venue helper inputs
- Update `src/lib/cost-estimation.ts` so `isLikelyFreePublicVenue(...)` also accepts:
  - `venueName`
  - `restaurantName`
  - `placeName`
- Keep the existing frontend pattern list unchanged.
- Include these fields in the combined text checked by the helper.

2. Pass full venue context everywhere the UI decides if something is free
- In `src/components/itinerary/EditorialItinerary.tsx`, pass:
  - `activity.venue_name`
  - `activity.restaurant?.name`
  - `activity.place_name`
  - `activity.location?.name`
- In `src/hooks/usePayableItems.ts`, expand the activity shape and pass the same venue metadata plus description/address where available.
- This directly fixes the “title doesn’t include miradouro, venue does” case.

3. Prevent client-side ledger sync from reviving paid rows
- Update `syncBudgetFromDays(...)` in `EditorialItinerary.tsx` to run the same free-venue check before adding positive `activitiesForCostTable` rows.
- If an activity is detected as a free public venue, do not sync a positive `activity_costs` row for it.
- Preserve cleanup so stale old paid rows for that activity are removed.
- Apply the same guard to any other client write path that syncs `activity_costs` directly, especially `src/components/itinerary/ItineraryAssistant.tsx`.

4. Keep the backend as final authority
- Do not remove or weaken the existing backend checks.
- Do not change the existing always-free pattern list.
- Keep post-generation `repair-trip-costs` as the authoritative final pass.
- If needed, reuse the existing repair call after client-side rewrite/regeneration flows that materially change activities.

Files to update

- `src/lib/cost-estimation.ts`
- `src/components/itinerary/EditorialItinerary.tsx`
- `src/hooks/usePayableItems.ts`
- `src/components/itinerary/ItineraryAssistant.tsx` (if its direct ledger sync remains active)

Verification

- Generate a fresh 4-day Lisbon trip.
- Confirm these both show as Free across itinerary cards, Payments tab, and budget totals:
  - a title containing `Miradouro`
  - a venue where `Miradouro` or `Jardim` appears only in `venue_name` / venue metadata
- Confirm museums, tours, galleries, and `bookingRequired` items stay paid.
- Confirm canonical `activity_costs` has no positive row for the free-venue activity after generation and after client-side edit/regeneration flows.
- Check backend logs for `FREE VENUE CHECK` and `PHANTOM PRICING FIX` during a fresh generation run; if no logs appear, that path was not exercised in the test.
