## Plan: stop the active generation leaks at every write/read boundary

### 1. Make the shared persist contract actually fail closed
- Fix `persistTripItinerary` so contract violations mutate the itinerary even when drops occur; today it passes a `days` reference that can stay stale when `enforceContractOnDays` replaces `day.activities`.
- After the contract runs, reassign `itinerary.days` from the cleaned day objects before saving.
- Add regression coverage for the exact 12:15 AM Day 2 hotel bleed, `find a local spot`, `Spa Time — find a venue`, and `(AESTHETIC slot)` stripping.

### 2. Expand ghost and placeholder detection
- Broaden hotel-ghost matching beyond only `Return to Hotel` to cover variants like `Return to the hotel`, `Return to Four Seasons Hotel`, `back at hotel`, `hotel bleed`, and pre-dawn accommodation/logistics rows.
- Broaden placeholder matching to catch `find a local spot in the destination`, `find a local spot in Venice`, `pick a local spot`, and wellness placeholders even when the placeholder appears in `name`, `venue_name`, `location.name`, or description fields.
- Keep the universal locking rule intact: user/manual/extracted/pinned/locked rows are not dropped.

### 3. Close remaining direct itinerary writes that bypass the backend contract
- Route client-side itinerary writes through the existing backend `save-itinerary` action or through a client scrubber equivalent before writing.
- Targets found during scan:
  - `src/services/safeUpdateItineraryData.ts`
  - `src/services/itineraryAPI.ts`
  - `src/services/itineraryActionExecutor.ts`
  - `src/services/itineraryOptimisticUpdate.ts`
  - `src/components/itinerary/EditorialItinerary.tsx`
  - import/manual-paste creation paths where appropriate
- Leave metadata-only trip updates alone.

### 4. Fix wrong-city restaurant filtering at the same boundary
- Ensure cross-city filtering checks all venue-bearing fields: title, name, venue name, restaurant name, location name/address/city, address, and description.
- Use per-day city fields first (`cityName`, `dayDestination`, `city`), then trip destination as fallback.
- Add tests for a multi-city day where the trip destination differs from the day city.

### 5. Remove the stale Payments “Totals differ” path
- Add a one-shot cleanup in `PaymentsTab` for legacy `payments_drift_*` localStorage keys.
- Verify there is no user-facing `Totals differ` render path remaining; keep only the dev-only assertion.
- If remaining mismatch is caused by orphaned `trip_payments`, normalize display to the canonical financial snapshot so users see one source of truth.

### 6. Validate with targeted tests and deploy
- Run the Supabase function tests for the shared persist contract.
- Deploy `generate-itinerary` after backend changes.
- Check recent function logs for `CONTRACT_VIOLATION` after deployment so we can confirm dirty rows are being caught instead of persisted.