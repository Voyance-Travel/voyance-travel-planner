

## Fix: generation_logs Table Always Empty

### Root Cause Analysis

The `generation_logs` table exists with correct schema. The `GenerationTimer.init()` inserts with the service role client (which bypasses RLS). The insert payload matches the schema. Yet the table has 0 rows.

Only one generation has run since the table was created (Rome trip, 3/29) — and that generation's chain broke silently (the bug we just patched). The `init()` error is wrapped in a try/catch that logs to console but never surfaces the error to callers. Since edge function logs aren't retained long enough to check retroactively, the failure mode is undiagnosable.

Two defensive fixes are needed:

### Changes

**1. `generation-timer.ts` — Make `init()` failures visible and non-blocking**
- If the insert fails, log the full error object (not just `error.message`) including any `details`, `hint`, or `code` fields
- Set a flag `initFailed: true` so `finalize()` can report it
- In `finalize()`, if `initFailed` is true, attempt one final insert as a fallback (captures at least the summary even if real-time tracking was lost)

**2. `action-generate-trip.ts` — Log timer init result**  
- After `timer.init()`, log whether a logId was obtained: `console.log('[generate-trip] Timer logId:', timer.getLogId() || 'FAILED')`
- This ensures the next generation attempt produces a visible diagnostic in edge function logs

**3. Migration — Add INSERT policy for `service_role` explicitly (belt-and-suspenders)**
- The existing "Service role can manage logs" policy targets `TO authenticated` with `USING (auth.uid() IS NULL)`, which is logically contradictory (authenticated users always have `auth.uid() != NULL`). This policy can never match.
- While service role bypasses RLS entirely (so this policy is irrelevant), it's misleading. Drop it and replace with a clear comment explaining that service role bypasses RLS.
- Add a simple `INSERT` policy for `authenticated` role so the poller/frontend can't accidentally write (read-only for authenticated users is already covered).

### Files

| File | Change |
|---|---|
| `supabase/functions/generate-itinerary/generation-timer.ts` | Enhanced error logging in `init()`, fallback insert in `finalize()` |
| `supabase/functions/generate-itinerary/action-generate-trip.ts` | Log timer init result for diagnostics |
| Migration (SQL) | Drop contradictory RLS policy, add clarifying comment |

