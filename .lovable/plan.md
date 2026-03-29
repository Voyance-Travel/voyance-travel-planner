

## Investigation Results: Why Generation Logs Appear Stuck

### Root Causes Found

**1. Multiple log rows per trip — latest one masks progress**
Each generation attempt calls `timer.init()` which creates a **new** `generation_logs` row. The client polls for the newest row (`ORDER BY created_at DESC LIMIT 1`). When a trip is retried, the newest row starts at 0% and if the chain breaks early, it stays stuck — hiding the older row that had actual progress data.

Evidence from the database — trip `cf8debc2` has **8 separate log rows**, most stuck at various phases:
- Row at 0% (`init`, `started`)
- Row at 10% (`pre_chain_setup`)
- Multiple rows at 26% and 42%

**2. Orphaned logs never get finalized**
When the edge function times out or the self-chaining breaks, `timer.finalize()` is never called. The log row stays as `in_progress` indefinitely with no `total_duration_ms`. There's no cleanup mechanism.

**3. `action-generate-day.ts` never writes progress to DB**
The inner day-generation handler resumes the timer and tracks phases in memory, but never calls `updateProgress()`. Only `action-generate-trip-day.ts` writes progress to DB — and only **after** a day fully completes. This means there's zero visibility into what's happening during the 30-120 seconds while a day is actively being generated.

### Fix Plan

**File: `supabase/functions/generate-itinerary/action-generate-trip.ts`**
- Before creating a new timer, check for an existing `in_progress` log row for this trip. If found and it's stale (>5 min old), mark it `failed` before creating a new one. This prevents orphaned rows from accumulating.

**File: `supabase/functions/generate-itinerary/action-generate-day.ts`**
- Add `updateProgress()` calls at key milestones within the day generation:
  - After context is loaded (~phase start)
  - After AI call completes
  - After post-processing
- This gives real-time visibility instead of only updating when a day fully completes in the orchestrator.

**File: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`**
- Add a `try/finally` block around the main logic to ensure `timer.finalize('failed')` is called even when the function crashes or times out.
- In the error/timeout path where the chain breaks, explicitly finalize the timer before returning.

**File: `src/components/planner/shared/GenerationPhases.tsx`**
- Update the polling query to also filter out logs older than 10 minutes as stale, so the UI doesn't show ancient stuck progress.

### Summary

| Issue | Root Cause | Fix |
|---|---|---|
| Logs stuck at 0-10% | Multiple rows per trip, newest one masks progress | Clean up stale rows before creating new ones |
| No mid-day progress | `action-generate-day.ts` never writes to DB | Add `updateProgress()` calls at key milestones |
| Logs never show "complete" on failure | `finalize()` not called on crash/timeout | Wrap in try/finally |
| Client shows stale data | Polling picks up orphaned rows | Filter out stale logs in query |

