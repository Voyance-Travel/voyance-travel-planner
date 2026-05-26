## Finish must-do coverage hardening

Pick up where the previous loop stopped: matcher + scheduler are patched, regression coverage and memory update are not.

### Steps

1. **Run the new Buenos Aires test** (`supabase/functions/_shared/__tests__/assert-must-do-coverage.buenos-aires.test.ts`) to confirm the tightened matcher rejects neighborhood-level cards as coverage for venue-level must-dos. Fix any fallout.

2. **Add scheduler-overlap regression test** under `supabase/functions/_shared/__tests__/schedule-must-dos.overlap.test.ts`:
   - Day already has a locked anchor occupying the chosen clock slot.
   - Asserts `scheduleMustDos` picks a non-overlapping slot (or defers to injection) rather than double-booking.
   - Asserts clock ceilings (17:00 museum / 21:00 after-dark) still respected.

3. **Run both new tests + existing `assert-must-do-coverage` / `schedule-must-dos` suites** to confirm no regressions.

4. **Update `mem://constraints/itinerary/must-do-coverage-injection`** with the matcher tightening (whole-word boundary on identity fields only, neighborhood ≠ venue) and the new overlap-safety contract. Refresh Core index line if wording shifts.

### Out of scope
- The Budget-vs-Card reconciliation thread (instrumentation already shipped; awaiting user repro logs).
- Return-flight arrival display bug (separate thread).
