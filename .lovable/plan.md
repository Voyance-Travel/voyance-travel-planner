

## Fix: Generation Crashes with CORS/500 + Stalled Retry UX

### Current State (Verified)

- **Chain retry logic** — Already correctly fixed (line 13558: `response.ok` only, 4xx break, maxRetries=5, backoff=3000ms)
- **innerTimer.updateProgress** — Already has calls at context_loaded, generated, saved, completing phases
- **Missing**: Global CORS safety net, phase label map gaps, frontend not marking trips as `failed` on stall

### Changes

**1. Global CORS Safety Net** — `supabase/functions/generate-itinerary/index.ts`

Wrap the `serve()` body (lines 4985-13633) in an outer try/catch. The current structure is:
```
serve(async (req) => {
  if (OPTIONS) return cors;
  try { ... } catch { ... mark failed, return with cors }
});
```
Add outer catch after the existing catch block that:
- Catches catastrophic errors (OOM, body parse failures, unhandled throws before the inner try)
- Best-effort: creates emergency supabase client, extracts tripId from request body, marks trip as `failed`
- Always returns `{ success: false, error: "...", code: "CATASTROPHIC_ERROR" }` with CORS headers

**2. Phase Labels** — `src/components/planner/shared/GenerationPhases.tsx`

Add to `PHASE_DISPLAY_TEXT` map (line 117-133):
- `init`: 'Initializing...'
- `completing`: 'Finishing up...'

Add regex patterns in `getPhaseDisplayText` for:
- `loading_day_N` → "Loading Day N..."
- `saved_day_N` → "Saving Day N..."

**3. Frontend Failed State** — `src/hooks/useGenerationPoller.ts` + `src/pages/TripDetail.tsx`

In the poller's `onStalled` callback (TripDetail line 343-345), after setting `generationStalled(true)`, also update the trip's `itinerary_status` to `'failed'` in the database so the user can cleanly retry on next page load.

In TripDetail, when `showStalledUI` renders (line 2333), change the copy from "Reconnecting..." to "Generation was interrupted" with clearer messaging and ensure the "Retry manually" button resets `itinerary_status` before triggering (already done via `handleResumeGeneration` at line 374).

**4. SQL Cleanup** — Run migration to reset stuck rows:
```sql
UPDATE trips SET itinerary_status = 'failed' WHERE itinerary_status = 'generating' AND updated_at < NOW() - INTERVAL '10 minutes';
UPDATE generation_logs SET status = 'failed', current_phase = 'timed_out', progress_pct = COALESCE(progress_pct, 10) WHERE status IN ('in_progress', 'started') AND created_at < NOW() - INTERVAL '10 minutes';
```

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/index.ts` | Outer try/catch around serve() for CORS safety |
| `src/components/planner/shared/GenerationPhases.tsx` | Add `init`, `completing`, `loading_day_N`, `saved_day_N` to phase map |
| `src/pages/TripDetail.tsx` | Mark trip failed on stall, improve stalled UI copy |

### Deploy

Single edge function redeploy + frontend build. SQL cleanup via migration tool.

