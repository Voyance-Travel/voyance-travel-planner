## What the evidence shows

**Do I know what the issue is? Yes.** This is not a browser console issue and it is not Day 1 “just taking a while.” The durable trace and backend logs show the day generator never starts.

Current trip evidence for `e4217b97-34b6-4de4-a842-2200db6f5f73`:
- Backend is healthy.
- Trip is still `generating`, `generation_completed_days = 0`.
- Durable trace stops at `launcher_frozen_guard_passed`.
- There is **no** `launcher_pre_chain_setup_complete`, **no** `launcher_day_1_invoke_queued`, and **no** `generate-trip-day day_started`.
- `generation_logs`, `trip_generation_traces`, and `trip_generation_stages` have no rows for this run.
- Edge logs say: `already generating ... skipping duplicate` immediately after the launcher starts.

## Root cause

The launcher now does a quick metadata write before starting the background chain:

```text
generate-trip request
  → sets trip.itinerary_status = generating
  → starts handleGenerateTripBackground via waitUntil
  → background passes frozen guard
  → background duplicate guard sees status = generating + fresh heartbeat
  → background incorrectly treats its own launch as a duplicate
  → returns before invoking generate-trip-day
```

So the UI is accurately stuck on “Crafting Day 1” because the trip was marked `generating`, but the self-chain never actually queued Day 1.

## Plan

1. **Fix the self-duplicate guard**
   - In `action-generate-trip.ts`, make the background runner recognize its own launcher run.
   - Reuse `params.__generationRunId` inside `handleGenerateTripBackground` instead of generating a new unrelated run id.
   - If `params.__backgroundLaunch === true` and the trip metadata `generation_run_id` matches, the duplicate guard must continue instead of returning `already_generating`.
   - Keep duplicate protection for real second browser clicks / stale tab retries.

2. **Make the logging answer this instantly next time**
   - Add a durable trace entry when the duplicate guard skips a run, e.g. `launcher_duplicate_skipped` with reason, heartbeat age, and run id match/mismatch.
   - Add/keep trace boundaries around:
     - `launcher_frozen_guard_passed`
     - duplicate guard result
     - `launcher_pre_chain_setup_complete`
     - `launcher_day_1_invoke_queued`
     - `launcher_day_1_invoke_returned`
   - Update the `TracePhase` union in `_shared/generation-trace.ts` so these phases are first-class, not ad-hoc strings.

3. **Add regression coverage**
   - Add a focused test for the launcher path showing:
     - quick metadata init sets status to `generating`
     - the matching background launch is allowed through
     - a mismatched/fresh duplicate is still skipped
   - This locks the exact failure mode so future hardening does not reintroduce the Day 1 stall.

4. **Unstick this affected trip after the code fix**
   - Reset this trip from stale `generating` back to `not_started` or requeue it cleanly.
   - Preserve the existing committed credit proof so there is no double charge.
   - Clear stale heartbeat/start markers and generation error fields.

5. **Verify with data, not guessing**
   - Trigger generation once.
   - Confirm durable trace reaches at least:
     - `launcher_pre_chain_setup_complete`
     - `launcher_day_1_invoke_queued`
     - `generate-trip-day / day_started`
   - Confirm `generation_completed_days` advances from `0`.
   - If Day 1 then fails inside the hardened Step 3/persist layer, it will show in `trip_generation_stages` and `generation_trace` instead of leaving the user staring at a spinner.

## User-facing behavior after this

- The app should no longer sit indefinitely on “Crafting Day 1 of 4” when the launcher silently skipped itself.
- If generation cannot start, the trip should move to a retryable failed/not-started state with a visible backend reason instead of appearing active forever.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>