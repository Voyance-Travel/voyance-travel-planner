

## Fix: Generation Logs Not Persisting

### Problem
The `generation_logs` table has **0 rows** despite a trip generating at 17:42 UTC today. The timer code exists in the source files but no `[perf]` log lines appear in edge function logs, meaning the **deployed function doesn't have the latest code**.

### Root Cause
The edge function needs to be **redeployed** so the `GenerationTimer` instrumentation takes effect. The code changes to `index.ts`, `action-generate-trip-day.ts`, and `generation-timer.ts` were saved to files but the running function is still the old version.

### Fix (2 steps)

**Step 1: Redeploy the edge function**
Use the deploy tool to push the current `generate-itinerary` function code. This is the primary fix — once deployed, `timer.init()` will create rows in `generation_logs` and all phase/token/model tracking will start recording.

**Step 2: Add a diagnostic log to confirm timer init**
Add a `console.log` right after `timer.init()` in `action-generate-trip.ts` (line 116) to confirm the log row was created:
```typescript
const logId = await timer.init(destination, totalDays, travelers || 1);
console.log(`[generate-trip] Timer initialized, logId=${logId}`);
```

This way, even if the DB insert silently fails, we'll see it in edge function logs.

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/action-generate-trip.ts` | Add diagnostic log after `timer.init()` |
| Edge function deployment | Redeploy `generate-itinerary` to pick up all timer changes |

### Verification
After redeployment, trigger a test generation and check:
1. Edge function logs show `[perf]` phase markers and `[generate-trip] Timer initialized, logId=...`
2. `generation_logs` table has a new row with `status`, `phase_timings`, `model_used`, and token counts populated

