I’ll treat these as active production regressions and fix them at the boundaries that can still bypass the previous cleanup.

## Plan

1. **Fix the contract itself**
   - Remove the stateful `/g` regex bug in `persist-itinerary.ts` that can intermittently skip `(slot)` / `(AESTHETIC slot)` matches.
   - Expand `persist-day-contract.ts` to evaluate a full activity blob: title, name, venue fields, location name/address/city, description, tags, and metadata.
   - Drop non-locked generic wellness rows before the UI can mask them as `Spa Time — find a venue`.
   - Drop non-locked meal stub rows such as `find a local spot`, `Café Matinal`, `Bistrot du Marché`, and unverified `needsVenuePick` sentinels instead of letting display sanitizers create placeholders.
   - Broaden the pre-dawn hotel ghost check to inspect title + description + location, including “hotel / resort / accommodation / lodging / return / back / check-in” variants at `00:00–04:59`.

2. **Close remaining raw write bypasses**
   - Remove direct `trips.itinerary_data` fallback writes from client save paths (`safeUpdateItineraryData`, action executor, optimistic update, generic trip save helpers, booking import where applicable).
   - If the backend save fails, return an explicit error instead of writing dirty JSON directly.
   - Add a small database-level last-gate scrub trigger for `trips.itinerary_data` so any remaining direct insert/update path cannot persist prompt artifacts, obvious placeholders, or pre-dawn hotel ghosts.

3. **Fix normalized table drift**
   - Update itinerary table sync so `itinerary_days.activities` and `itinerary_activities` are synced from the already-cleaned JSON snapshot.
   - Delete stale non-locked normalized activities that are no longer present in the cleaned day.
   - Fix the stale-table cleanup bug that deletes by the wrong column name when starting a fresh generation.
   - Ensure TripDetail/ItineraryGenerator fallback reads apply the same ghost/placeholder filter before rendering table-backed fallback data.

4. **Fix wrong-city venue leakage**
   - Run cross-city checks on all venue-bearing fields, including description and address/city fields.
   - Prefer per-day city from `day.cityName`, `day.dayDestination`, `day.city`, and trip-city mapping before falling back to trip destination.
   - Add regression cases for known wrong-city restaurant leaks and multi-city days.

5. **Fix Payments sync mismatch**
   - Make Payments use the same canonical live-activity/payment filter as the financial snapshot.
   - Exclude/auto-archive paid rows whose item no longer exists in the live itinerary, except hotel/flight/manual expenses.
   - Reconcile or delete non-manual `activity_costs` rows whose activity IDs no longer exist after a cleaned save so totals cannot drift after ghost/placeholder removal.

6. **Validate and deploy**
   - Add targeted Deno tests for:
     - 12:15 AM Day 2 hotel bleed variants
     - generic wellness → no `Spa Time — find a venue`
     - meal stub → no `find a local spot`
     - intermittent prompt artifact regex skip
     - wrong-city restaurant fields
     - payment orphan filtering
   - Run the edge-function tests and deploy `generate-itinerary`.
   - Query recent generated trips after deployment for the banned patterns to verify they no longer persist.