## Timing diagnosis

The Rome trip still shows real timing corruption, not just missing must-dos:

- **Day 1 JSON is impossible:** `Dinner: Roscioli` is `00:00–01:15`, then `Arrival Flight` is `02:30–04:30`, then luggage drop at `05:30`, then breakfast at `11:40`, lunch at `17:30`, and Colosseum at `21:30–23:45`.
- **Duplicate hotel returns survived:** Day 1 has multiple `Return to Hotel`/hotel-bound cards near `18:36`, `23:41`, `23:50`, and `23:59`.
- **JSON and normalized tables diverge:** `itinerary_activities` has luggage drop before the arrival flight and different flight timing than `trips.itinerary_data`.
- **Metadata is not trustworthy yet:** `metadata.must_do_coverage` is missing, `generation_health` is missing, and `fully_persisted=false`, so the current trip is still in an inconsistent self-heal state.
- **Current timing defenses are fragmented:** there are many useful guards, but they run in different places and some only stamp warnings instead of forcing a safe schedule before table sync.

## Fix plan

### 1. Add one canonical timing sanity pass
Create a shared backend helper, e.g. `sanitizeScheduleTiming`, that runs after generation/repair/meal guard and before every persist/table sync.

It should enforce:

- No non-locked meal or sightseeing card at `00:00–05:59` unless explicitly tagged as valid late-night nightlife.
- Day 1 non-logistics cannot occur before `arrival + buffer`.
- Arrival logistics must be ordered as flight/arrival → luggage drop/check-in → first real activity.
- Landmarks/museums/sightseeing cannot start after the daylight cutoff unless explicitly nightlife-capable.
- A day can have only one terminal hotel-return bookend, keeping the last valid one.
- Any card with `endTime < startTime` must be either a valid late-night wrap or repaired/dropped.
- Meals must sit in their real windows: breakfast morning, lunch midday, dinner evening; `00:00 dinner` is never valid.

### 2. Wire the pass into all write paths
Run the canonical timing pass in:

- `action-generate-trip-day.ts` before `persistTripItinerary` final and intermediate writes.
- `action-save-itinerary.ts` before persist validation and before `persistTripItinerary`.
- `_shared/persist-itinerary.ts` as a final chokepoint so chat/manual/self-heal paths cannot bypass it.
- `action-sync-tables.ts` or the table sync boundary so normalized rows mirror repaired JSON, not stale pre-repair order.

### 3. Promote timing failures into health metadata
Update `validateItineraryForPersist` / generation health so bad timing is visible and blocks “ready” when severe:

- Add or harden codes like `INVALID_PREDAWN_MEAL`, `ARRIVAL_SEQUENCE_INVALID`, `DUPLICATE_HOTEL_RETURN`, `LANDMARK_AFTER_DARK`, `JSON_TABLE_TIME_DRIFT`.
- Include sample day/activity IDs in `metadata.generation_health.persistGateCodes`.
- Ensure `metadata.persist_validation` is computed after the final timing pass, not before it.

### 4. Repair Rome trip in place
Apply a one-shot data repair for `d18b2e8a…`:

- Rewrite Day 1 into a believable arrival day: arrival/logistics first, no midnight dinner, Colosseum moved to a daylight slot or another full day.
- Inject/restore Vatican, Pantheon, and Trevi in daylight/appropriate windows.
- Remove duplicate hotel returns and the hotel-bound transit at `23:50`.
- Sync `itinerary_days` / `itinerary_activities` from the repaired JSON.
- Restamp `must_do_coverage`, `persist_validation`, `generation_health`, and `fully_persisted=true` only after JSON + tables agree.

### 5. Add regression tests
Add targeted tests for:

- `00:00 dinner` gets repaired/dropped.
- Arrival flight cannot appear after luggage drop or first real activity.
- Duplicate hotel returns collapse to one terminal card.
- Landmark after dark gets moved to daylight.
- JSON/table sync preserves repaired times and sort order.
- Rome fixture: Colosseum/Pantheon/Trevi/Vatican all covered and no nonsensical timing remains.

## Files likely involved

- `supabase/functions/_shared/timing-cascade.ts`
- `supabase/functions/_shared/validate-itinerary-for-persist.ts`
- `supabase/functions/_shared/persist-itinerary.ts`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- `supabase/functions/generate-itinerary/action-save-itinerary.ts`
- `supabase/functions/generate-itinerary/action-sync-tables.ts`
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts`
- `supabase/functions/generate-itinerary/pipeline/validate-day.ts`
- Matching tests and one Rome data repair/update

## Out of scope

- Rebuilding the full itinerary scorer.
- Charging credits for this self-heal.
- Multi-retry regeneration loops.