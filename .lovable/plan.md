## Plan

### What I verified
- The current code already contains several proposed defenses: relax-pass scheduling, urgent backlog prompt injection, always-on must-do seeding, intent seed audit, `LANDMARK_AFTER_DARK`, and `assertMustDoCoverage`.
- The affected Rome trip is still broken in persisted data:
  - `trip_day_intents` now has the 4 must-do rows.
  - `metadata.must_do_coverage` is still missing.
  - `metadata.generation_health` is still missing.
  - Day 1 still has `Arrival Flight` at 06:40–08:40 and Colosseum at 21:30–23:45.
  - Days 2–3 still contain mostly dining and no Vatican/Pantheon/Trevi.
- The remaining gap is not just prompt injection: the final coverage assertion logs/stamps coverage but does not feed `MUST_DO_UNCOVERED` into `generation_health.persistGateCodes`, and there is no deterministic repair path for missing must-dos or late landmarks.

### Implementation steps

1. **Tighten must-do scheduling with real travel-day clocks**
   - Extend `scheduleMustDos` / `findBestDay` to accept arrival/departure timing context.
   - Relax arrival/departure only when there is an actual usable window, rather than blindly allowing Day 1/Day N.
   - Keep the 600-minute relax cap, but make the rationale explicit in logs.

2. **Make uncovered must-dos visible in every relevant day prompt**
   - Keep the existing urgent backlog block.
   - Add active, unfulfilled `trip_day_intents` must-do rows into the backlog, not only `scheduled.unschedulable`.
   - Suppress only on true tight departure days.
   - Ensure the daylight rule appears for all injected landmark must-dos, not just unschedulable ones.

3. **Finish post-generation coverage enforcement**
   - Move/adjust coverage assertion so it runs before final `writeGenerationHealth`.
   - Add `MUST_DO_UNCOVERED` into `generation_health.persistGateCodes` when coverage is missing.
   - Append a generation trace event with missing/scheduled counts.
   - Stamp `metadata.must_do_coverage` every terminal generation, including zero-missing success.

4. **Add deterministic repair for late landmarks**
   - In `repair-day.ts`, handle `LANDMARK_AFTER_DARK` by moving the landmark into a daylight slot where possible.
   - Prefer swapping with the latest non-meal afternoon cultural/leisure block.
   - Never move locked/manual/user activities.
   - Re-run timing/buffer cascade afterward.

5. **Add a single missing-must-do repair attempt**
   - If final coverage has missing must-dos and `metadata.must_do_repair_attempted` is not set, perform one deterministic repair pass on the lightest non-departure day.
   - Insert fixed landmark cards using known/resolved venue data when available.
   - Mark `metadata.must_do_repair_attempted` to prevent loops.
   - If repair still fails, leave the trip as generated but visibly flagged via coverage + health metadata.

6. **Repair Rome trip `d18b2e8a…` in place**
   - Use a data update, not a schema migration.
   - Fix Day 1 arrival flight back to the real landing window and move Colosseum to daylight.
   - Inject:
     - Day 2 morning: Vatican Museums / St. Peter’s Basilica block.
     - Day 3 morning: Pantheon + Trevi Fountain.
   - Remove/replace conflicting food-only filler where necessary.
   - Recompute table rows and cost rows through the existing save/sync path where possible, preserving locks and existing trip metadata.
   - Stamp `metadata.must_do_coverage`, `generation_health`, and a trace entry explaining the self-heal.

7. **Tests**
   - Add/update tests for:
     - short-trip relax-pass with 4 must-dos;
     - urgent backlog from unfulfilled trip-wide intents;
     - coverage assertion feeding `MUST_DO_UNCOVERED` into health metadata;
     - `LANDMARK_AFTER_DARK` daylight repair;
     - intent seeding audit for array `mustDoActivities` plus `perDayActivities`.

### Files to touch
- `supabase/functions/generate-itinerary/must-do-priorities.ts`
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts`
- `supabase/functions/generate-itinerary/pipeline/validate-day.ts`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- `supabase/functions/_shared/assert-must-do-coverage.ts`
- `supabase/functions/_shared/day-intents-store.ts`
- `supabase/functions/_shared/intent-normalizers.ts`
- Matching tests
- One data backfill/update for trip `d18b2e8a…`

### Out of scope
- Rebuilding the entire must-do scorer.
- Multi-retry regeneration loops.
- Changing user credit policy or charging for this self-heal.