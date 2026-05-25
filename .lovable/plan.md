# Must-Do Coverage: Mexico City "Teotihuacan + Zócalo missing" — same class as Rome

## Root cause (verified against trip `e4217b97…`)

The DB-stamped `metadata.must_do_coverage` for this trip says:
```
missing: []
matchedActivityIds: {
  "Teotihuacan Pyramids": "must-do-d1-0-1779750866846",
  "Zócalo (Plaza de la Constitución)": "must-do-d1-1-1779750866846",
  ...
}
```
But `trips.itinerary_data` contains **zero** activities with IDs starting `must-do-`. The injected anchor cards never made it to the persisted JSON. The coverage assertion lied because it read the in-memory `partialItinerary.days` (which the injector mutated) instead of the bytes actually written to disk.

Three independent failures are stacking:

1. **Coverage check reads the wrong source.** `action-generate-trip-day.ts` line 3829 calls `assertMustDoCoverage(partialItinerary?.days, mustDos)` AFTER `persistTripItinerary`, `action-sync-tables`, and the schedule-sanity pass have all run. Those passes can (and do) drop injected anchors via chronology repair, sanitizeSchedule overlap removal, or the no-regression overwrite guard — and the in-memory array is never re-synced from the post-persist DB row.

2. **Scheduler is duration-blind for half-day excursions.** `defaultDuration` in `_shared/schedule-must-dos.ts` returns 90 min for "Teotihuacan Pyramids". Teotihuacan is a ~6-hour round-trip from CDMX (50km out of city). The scheduler picked Day 1 (morning arrival), wedged a 90-min block into a window already overlapping luggage-drop / Roma-Norte walk, and the downstream cascade silently won the collision.

3. **Anchor drops are silent.** Whichever pass strips the collided `must-do-` card (cascade / chronology / sanitizeSchedule) emits no telemetry tying the dropped row back to a must-do venue. Coverage shows green and the user sees a missing landmark.

This is the same shape as the Rome `d18b2e8a…` trip (3 of 4 landmarks missing).

## Fix

### A. Coverage must read DB, not memory  *(highest signal)*
- In `action-generate-trip-day.ts`, after Phase 5 (`action-sync-tables`) and `writeActivityCostsFromItinerary`, re-fetch `trips.itinerary_data` from DB and pass that into `assertMustDoCoverage` — never `partialItinerary.days`.
- Mirror the same change in `action-save-itinerary.ts`.
- If post-DB coverage shows `missing.length > 0`:
  - Stamp `metadata.must_do_coverage` honestly (don't whitewash).
  - Append `MUST_DO_UNCOVERED` to `metadata.generation_health.persistGateCodes`.
  - Emit `[MUST_DO_DROPPED_BY_PIPELINE] trip=… venue=… injectedId=… droppedBetween=inject→persist` so we can attribute future drops.

### B. Re-inject + retry once if DB coverage drops post-persist
- If injection ran and DB-read coverage still shows the same venues missing, run `injectMissingMustDos` a second time against the DB-fetched days, then re-persist via `persistTripItinerary({ allowFrozenWrite:true, label:'must-do-retry' })`.
- Cap at one retry to avoid loops; on second failure, fall through to (C).

### C. Scheduler duration awareness for long-haul landmarks
- Extend `_shared/schedule-must-dos.ts`:
  - Add `LONG_HAUL_LANDMARKS` set with min-duration overrides (Teotihuacan 360min, Versailles 300, Pompeii 300, Petra 300, Machu Picchu 480, Giza Pyramids 300, etc.).
  - Reject candidate days where the contiguous free window < `minBlockMinutes`.
  - Reject Day 1 morning-arrival and Day N departure for `minBlockMinutes ≥ 240`.
- When the scheduler can't place a long-haul landmark on any day, return it in `unscheduled` cleanly — the coverage gate then surfaces `MUST_DO_UNCOVERED` to the user instead of silently dropping.

### D. Frontend surfacing
- `TripHealthPanel` already reads `persistGateCodes`; add a user-visible warning row when `MUST_DO_UNCOVERED` is present: *"Teotihuacan Pyramids couldn't fit into your schedule — open the Assistant to add it."* (read-only — no auto-fix).

### E. Attribution telemetry inside persist pipeline
- In `persist-itinerary.ts` and `_shared/sanitize-schedule-timing.ts`, when a row with `source === 'must-do-injection'` or `anchorSource === 'must_do'` is filtered/dropped, log `[MUST_DO_ANCHOR_DROPPED] reason=… site=…` so we can locate the exact pass causing drops in future regressions.

### F. Memory + test coverage
- Update `mem://constraints/itinerary/must-do-deterministic-injection` (or create it if missing) to document: coverage must be DB-sourced post-persist; long-haul landmarks have hard min-duration gates; injection retries once on post-persist loss.
- Add Deno tests:
  - `assert-must-do-coverage.test.ts`: scheduler stamps `missing` truthfully when injected card is absent from passed-in days (simulating post-persist drop).
  - `schedule-must-dos.test.ts`: Teotihuacan rejects Day 1 morning-arrival and any day without a 360-min contiguous free block.

## Out of scope
- Re-architecting the persist-pipeline drop-on-collision behavior (orthogonal — covered by the existing No-Regression-Overwrite Guard).
- Adding new must-do landmarks beyond the long-haul registry needed to close this bug class.
- Auto-rebuilding a day around a long-haul anchor (treat as future work — for now we surface, not auto-fix).

## Expected result
- Mexico City trip after a re-run shows either Teotihuacan + Zócalo persisted in `itinerary_data` (most common), or `MUST_DO_UNCOVERED` warning visible in the UI with the two venues named.
- No more whitewashed `must_do_coverage` rows where `matchedActivityIds` point at IDs that don't exist in the saved itinerary.
