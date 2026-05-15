## What we were trying to fix
Prevent page-load/background logic from silently re-running itinerary generation and overwriting an already-saved itinerary with new LLM output. The prior work removed the two true regressions: `useAutoResume` and the `useGenerationPoller` stall auto-invoke.

## What I verified
- `useGenerationPoller` now only reports stalls; it no longer invokes `generate-itinerary` or passes `isResume: true`.
- `TripDetail.tsx` still has exactly five `action: 'generate-trip'` call sites:
  1. `handleResumeGeneration` — explicit user retry/regenerate action.
  2. `triggerGeneration` — queued multi-city leg handoff.
  3. `stuckHealAttempted` — journey leg recovery.
  4. `notStartedHealAttempted` — mobile/chat-planner empty-trip recovery.
  5. Extend-days dialog — explicit user-confirmed new-day generation.
- The remaining concern is not that those sites exist; it is that their guards should be strong enough to avoid firing when saved activity data already exists.

## Correct fix to implement
1. **Harden queued-leg handoff**
   - Before `triggerGeneration` invokes generation, re-check the current trip row for existing `itinerary_data` and `itinerary_days` rows.
   - If either contains real activities/days, do not invoke generation; instead refresh local state and/or correct stale status.

2. **Harden stuck journey self-heal**
   - Keep the existing `count(itinerary_days) === 0` guard.
   - Add a second guard against real `itinerary_data` activities before invoking generation.
   - This prevents table/JSON mismatch cases from regenerating over visible content.

3. **Harden not-started chat-planner self-heal**
   - Keep the existing `hasItineraryData(trip)` guard.
   - Add a backend table-count guard (`itinerary_days` count must be zero) before marking the trip `generating` or invoking generation.
   - This covers cases where JSON is stale/empty but normalized day rows already exist.

4. **Strengthen regression tests**
   - Update `TripDetail.no-silent-regen.test.ts` so it does more than count call sites:
     - queued-leg branch must check current-trip stored data before invoke;
     - stuck-heal branch must check both `itinerary_days` and `hasItineraryData`;
     - not-started branch must check both `hasItineraryData` and `itinerary_days`.
   - Keep the existing guard banning `useAutoResume` and poller auto-resume.

5. **Update memory/documentation**
   - Update the no-auto-resume memory to state the full invariant: no page-load generation unless both JSON itinerary data and normalized day rows are empty, except explicit user actions.

## Out of scope
- Do not delete the legitimate mobile/server-chain recovery paths.
- Do not change backend generation logic.
- Do not alter user-facing design or payment behavior.