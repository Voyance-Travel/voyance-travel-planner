Do I know what the issue is? Yes — the likely root is not the browser refresh itself. A hard refresh exposes that some itinerary writes are still bypassing the canonical save/persist pipeline, so the UI can show one in-memory version while the database, normalized tables, costs, and metadata settle to another version.

The concrete risky path I found is `saveItineraryOptimistic`: when an itinerary version is cached, it calls the `optimistic_update_itinerary` RPC directly. That RPC writes `trips.itinerary_data` raw, bypassing the backend save contract, frozen guard, timing/schedule cleanup, table sync, activity-cost sync, metadata merge, and `TRIP_PERSISTED_EVENT` resync. This is exactly the kind of deep-seated path that makes “it looked fixed until hard refresh” recur.

Plan:

1. Remove the raw optimistic itinerary write path
   - Refactor `src/services/itineraryOptimisticUpdate.ts` so every itinerary save goes through `safeUpdateItineraryData` / `generate-itinerary` `save-itinerary`.
   - Keep conflict detection, but stop using `optimistic_update_itinerary` to write `itinerary_data` directly.
   - After save, force canonical DB resync so the current screen matches what a hard refresh will show.

2. Make user-initiated patchers use the same boundary
   - Update flight/hotel itinerary patchers and “keep mine” conflict save paths to call the safe persistence path with explicit user reasons.
   - Ensure these still pass `allowFrozenWrite` only when the user directly changed flight/hotel/itinerary data.

3. Stop page-load effects from changing frozen itineraries
   - Audit TripDetail mount-time writers, especially day-mode backfill and table/JSON recovery.
   - Convert harmless page-load backfills to metadata-only or read-time derivation.
   - Only allow frozen-trip self-heal writes for narrow, proven corruption cases; otherwise log and leave canonical DB JSON untouched.

4. Strengthen the guardrail test suite
   - Extend the existing “no raw itinerary writes” test to flag RPC writes like `optimistic_update_itinerary`, not just `.update({ itinerary_data })`.
   - Add tests that `saveItineraryOptimistic`, hotel patch, flight patch, conflict “keep mine”, and page-load backfills cannot bypass `safeUpdateItineraryData`.
   - Add a hard-refresh invariant test: after a save, the local rendered itinerary must be sourced from the same canonical payload that a fresh DB read returns.

5. Add focused telemetry for the next repro
   - Add one structured warning when any save returns a canonical DB payload different from the attempted local payload.
   - Include save reason, frozen status, version, day/activity counts, meal counts, and whether activity-cost/table sync ran.
   - This gives us one place to diagnose future refresh drift instead of chasing tab-by-tab symptoms.

Expected result:
- The app should no longer show a pre-refresh itinerary/total that differs from post-refresh because there will be one persistence chokepoint and one canonical resync path.
- Any remaining difference after refresh should become a logged contract violation with a single trace, not another invisible side effect.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>