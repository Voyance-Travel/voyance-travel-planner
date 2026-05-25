## Plan

### What I verified

- A first version of `sanitize-schedule-timing.ts` already exists and is wired into `persist-itinerary.ts`, but it is still too narrow: it fixes predawn meals, alias drift, bad wraps, and duplicate hotel returns only.
- The Rome JSON is partially healed, but still invalid: Day 1 has dinner before the arrival flight, Colosseum at 21:30, and two terminal hotel returns.
- The normalized tables are worse than JSON and stale: they still contain `Dinner: Roscioli` at `00:00–01:15`, luggage drop before arrival flight, and extra hotel-bound rows. This confirms the core bug is not just generation — it is also JSON/table sync drift.
- Metadata is still incomplete: `must_do_coverage` exists, but `generation_health` is missing and `schedule_sanity_trace` is empty.

### Implementation steps

1. **Harden the existing canonical timing pass**
   - Extend `supabase/functions/_shared/sanitize-schedule-timing.ts` rather than creating a parallel helper.
   - Add context-aware rules for:
     - Day 1 arrival sequence: arrival flight/arrival logistics before luggage drop/check-in before first real activity.
     - Day 1 real activities cannot start before `arrival + buffer`.
     - Meal windows: breakfast morning, lunch midday, dinner evening; no `00:00` dinner.
     - Daylight-sensitive landmarks/museums/sightseeing cannot start after the cutoff unless tagged as nightlife-safe.
     - Duplicate terminal hotel returns collapse to one final bookend, and adjacent hotel-bound transit stubs are removed.
     - Invalid `endTime < startTime` is repaired only when safe, otherwise dropped.
   - Return structured counters and validation codes, not just console logs.

2. **Run timing cleanup before validation and table sync**
   - In `action-save-itinerary.ts`, run the timing pass before `validateItineraryForPersist`, so `metadata.persist_validation` describes the final repaired plan, not stale pre-repair data.
   - In `action-generate-trip-day.ts`, run it before final `persist_validation`, before `persistTripItinerary`, and before table sync/cost sync.
   - Keep the existing `persist-itinerary.ts` call as the final chokepoint for chat/manual/self-heal paths.
   - In `action-sync-tables.ts`, run the timing pass on the JSON being mirrored so normalized rows cannot preserve stale impossible times.

3. **Promote severe timing problems into health metadata**
   - Extend `validate-itinerary-for-persist.ts` with hard timing codes:
     - `INVALID_PREDAWN_MEAL`
     - `ARRIVAL_SEQUENCE_INVALID`
     - `DUPLICATE_HOTEL_RETURN`
     - `LANDMARK_AFTER_DARK`
     - `INVALID_TIME_WRAP`
   - Include day/activity samples in `metadata.persist_validation` and `metadata.generation_health.persistGateCodes`.
   - Ensure terminal generation writes `generation_health` after final JSON/table sync checks.

4. **Make JSON/table drift detectable**
   - Add a lightweight post-sync verifier that compares JSON activity title/start/end order against `itinerary_activities` for the same trip.
   - If drift remains, stamp `JSON_TABLE_TIME_DRIFT` in generation health and do not mark the trip fully persisted.
   - If sync succeeds, stamp `fully_persisted=true` only after JSON and normalized tables agree.

5. **Repair the Rome trip in place**
   - Apply a one-time data update for trip `d18b2e8a-310e-42c8-a7aa-aac61076a234`.
   - Rewrite Day 1 into believable order: arrival/logistics first, no midnight dinner, no late-night Colosseum, one terminal hotel return.
   - Keep/restore Vatican, Pantheon, Trevi, and Colosseum in valid windows.
   - Re-sync `itinerary_days` and `itinerary_activities` from repaired JSON.
   - Restamp `must_do_coverage`, `persist_validation`, `generation_health`, and `fully_persisted=true` only after JSON/table parity passes.

6. **Add regression tests**
   - `00:00` dinner is repaired to dinner window.
   - Arrival flight cannot appear after luggage drop or the first real activity.
   - Duplicate hotel returns collapse to one terminal card.
   - Landmark/museum after dark is moved or flagged.
   - Sync tables mirrors repaired JSON times and order.
   - Rome fixture has Colosseum, Vatican, Pantheon, and Trevi covered with no nonsensical timing.

### Files to edit

- `supabase/functions/_shared/sanitize-schedule-timing.ts`
- `supabase/functions/_shared/validate-itinerary-for-persist.ts`
- `supabase/functions/_shared/persist-itinerary.ts`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- `supabase/functions/generate-itinerary/action-save-itinerary.ts`
- `supabase/functions/generate-itinerary/action-sync-tables.ts`
- Existing matching tests plus a Rome fixture/regression test

### Out of scope

- Rebuilding the full itinerary scorer.
- Charging credits for this self-heal.
- Multi-retry regeneration loops.