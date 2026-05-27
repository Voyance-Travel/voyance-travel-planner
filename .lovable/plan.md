## Diagnosis

The Barcelona trip proves this is not just a prompt issue:

- `trips.metadata.mustDoActivities` contains the 5 user choices: Park Güell, Barri Gòtic, La Rambla, Mercat de la Boqueria, Sagrada Família.
- `trip_day_intents` is empty for the trip.
- `metadata.intent_seed_audit` says `generated: 5, written: 0`, matching the old failed PostgREST upsert path.
- The persisted itinerary contains only logistics: arrival flight, hotel check-in, return-to-hotel, checkout, airport transfer.
- `metadata.must_do_coverage` correctly says all 5 must-dos are missing.
- The match verdict incorrectly says `mustDos: 0/0` because its snapshot did not include metadata must-dos.

The deeper architecture failure is circular:

```text
must-dos missing
  → itinerary has too few meaningful activities
  → isComplete = false
  → deterministic must-do injection is skipped because it only runs when isComplete
  → shell itinerary persists as partial/ready-ish logistics output
  → user sees an empty paid trip
```

So even after fixing intent seeding, the final safety net still cannot rescue the exact failure mode it was built for.

## Plan

### 1. Make intent seeding reliable and diagnosable

Update `supabase/functions/_shared/day-intents-store.ts` so seeding reports rows that are usable, not just newly inserted rows.

- Keep the fetch-then-insert implementation.
- Return an audit shape that distinguishes:
  - generated intents
  - inserted intents
  - already-existing matching intents
  - active/fulfilled rows available after seeding
- Change the blocking path so it fails only when preference metadata exists and there are still zero usable intent rows after seeding.
- Keep expression-index-safe JS dedupe; never reintroduce `.upsert(... onConflict ...)`.

### 2. Promote metadata must-dos to first-class generation inputs

In the generation path, treat `metadata.mustDoActivities` as authoritative even when `trip_day_intents` is empty or stale.

- Ensure `compile-prompt.ts` continues merging both structured rows and legacy metadata.
- Add stronger trace fields showing:
  - `metadataMustDosCount`
  - `structuredIntentCount`
  - `promptForDayCount`
  - source counts from the preference spine
- Make the match verdict / generation trace read from the same merged preference spine, so it can never report `mustDos: 0/0` when metadata has must-dos.

### 3. Move must-do injection before the completeness gate

Update `supabase/functions/generate-itinerary/action-generate-trip-day.ts` so deterministic must-do injection runs at terminal chain finalization even when the itinerary is currently incomplete.

Current bad condition:

```ts
if (dayNumber >= totalDays && isComplete && Array.isArray(partialItinerary?.days))
```

Replace with a terminal-chain condition:

```ts
if (dayNumber >= totalDays && Array.isArray(partialItinerary?.days))
```

Then recompute after injection:

- meaningful activity count
- all-days-have-activities
- `isComplete`
- final status
- persist validation
- must-do coverage

This removes the circular dependency where must-do injection is blocked because must-do injection has not happened yet.

### 4. Add a hard “selected places cannot silently miss” persist gate

If metadata contains selected places and final coverage still has missing entries:

- Do not mark the trip `ready`.
- Persist `generation_health.persistGateCodes` with `MUST_DO_UNCOVERED` and/or `MUST_DO_INJECTION_FAILED`.
- Keep the itinerary visible as partial if needed, but surface a clear recoverable failure state instead of a polished shell trip.

This means a user never gets a paid “complete” trip that ignores their selected places.

### 5. Add a Barcelona regression test fixture

Add tests around the exact case:

- 2-day Barcelona trip.
- Day 1 late check-in around 10:25 PM.
- Day 2 departure logistics.
- Metadata must-dos: Park Güell, Barri Gòtic, La Rambla, Mercat de la Boqueria, Sagrada Família.

Assertions:

- Seeding produces or finds 5 usable intents.
- Must-do coverage starts missing all 5.
- Terminal injection runs despite pre-injection `isComplete === false`.
- Final status is not `ready` unless coverage is satisfied.
- Generation trace/match verdict does not claim `0/0 must-dos`.

### 6. Repair the existing affected trip data

After code changes, run a one-time data repair for the affected trip(s):

- Re-seed `trip_day_intents` from metadata using the fixed seeder.
- Clear stale `fully_persisted` / frozen metadata only if needed for regeneration recovery.
- Trigger or enable a clean regeneration path that can rebuild the trip with selected places included.

### 7. Finish the excluded-hotel header clarity fix

Complete the partially implemented frontend presentation fix:

- In `EditorialItinerary.tsx`, change the header label to `Trip Total · activities only` when hotel/flight costs are known but excluded by budget toggles.
- Add a tooltip explaining that hotel/flight are tracked but excluded from this total.
- Add muted equation-row chips like `Hotel $250 excluded` / `Flights $X excluded` without changing the underlying budget math.
- Add tests in `headerStripValues.test.ts` for excluded hotel, excluded flight, and both excluded.

## Validation

Run focused checks only:

- Edge-function tests for intent seeding, must-do scheduling/injection, and Barcelona fixture.
- Frontend unit tests for `computeHeaderStripValues`.
- Database read-back on the affected trip confirming:
  - `trip_day_intents` has the expected 5 rows after repair.
  - `must_do_coverage` no longer silently says missing while status is ready.
  - header values expose excluded hotel cost clearly.