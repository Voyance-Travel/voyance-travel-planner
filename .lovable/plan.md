
Diagnosis

- There are two separate issues in the logs.

1. Parser warning
- The warning comes from `src/utils/itineraryParser.ts` where `parseItineraryDays(...)` compares parsed day count against the trip date span and logs:
  `parsed 4 days but trip dates ... imply 5 days`.
- This warning is diagnostic only. It does not break the UI by itself.
- The most likely trigger is the in-progress generation preview in `src/pages/TripDetail.tsx`, where partial days from `generationPoller.partialDays` are rendered with the full trip date range:
  `parseEditorialDays({ days: generationPoller.partialDays }, trip.start_date, trip.end_date)`
- I also checked the backend trip data for the trip in your log, and it currently has 5 stored days with dates `2026-04-09` through `2026-04-13`. So the warning is likely about partial/stale frontend data, not the saved final itinerary.

2. 500 + CORS-looking failure
- The failing request is tied to `repairTripCosts(...)` in `src/services/activityCostService.ts`, which calls the `generate-itinerary` backend action `repair-trip-costs`.
- There is a concrete runtime bug in `supabase/functions/generate-itinerary/action-repair-costs.ts`:
  - `source` and `wasCorrected` are assigned inside the ticketed-attraction branch
  - but their `let` declarations appear later in the same block
- That is a Temporal Dead Zone runtime error and can crash the action before it completes.
- The browser then surfaces this as a failed edge-function request and may show it as a CORS issue, even though the real problem is the backend action crashing.

Implementation plan

1. Fix the backend cost-repair crash
- Update `supabase/functions/generate-itinerary/action-repair-costs.ts`
- Move `let source = "repair"` and `let wasCorrected = false` above the first ticketed-attraction override block
- Keep correction counting consistent so `corrected` is not incremented twice for the same activity

2. Stop false-positive parser mismatch warnings during partial rendering
- Update `src/utils/itineraryParser.ts` to support a “partial/in-progress” parse mode, or gate the mismatch warning so it only runs for finalized/full itineraries
- Update the partial preview callsite in `src/pages/TripDetail.tsx` to use that mode when rendering `generationPoller.partialDays`

3. Keep real mismatch detection for actual bad saved data
- Do not remove the warning globally
- Keep it active for final saved itinerary parsing so it still catches genuine date/day corruption

4. Verify the noisy repair flow callsites
- Check both existing callers:
  - auto-repair on trip load in `src/pages/TripDetail.tsx`
  - async repair after regeneration in `src/components/itinerary/EditorialItinerary.tsx`
- Ensure they fail quietly if the repair action is unavailable, instead of creating repeated scary console noise

Verification

- Open the affected trip and confirm the partial-generation UI no longer logs repeated day-count mismatch warnings
- Confirm the final saved itinerary still parses to 5 days
- Trigger the pricing repair path and confirm `repair-trip-costs` returns normally instead of `FunctionsFetchError`
- Confirm the browser no longer shows the `generate-itinerary` 500/CORS-style failure for this repair flow

Technical details

- Warning source: `src/utils/itineraryParser.ts` lines around the day-count diagnostic
- Partial-data callsite: `src/pages/TripDetail.tsx` where `generationPoller.partialDays` is parsed with full trip dates
- Failing frontend service: `src/services/activityCostService.ts`
- Likely backend crash location: `supabase/functions/generate-itinerary/action-repair-costs.ts`
- No database schema, auth, RLS, or secrets changes should be needed for this fix
