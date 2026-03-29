

## Fix: Generation Logging — Add Timer Updates to `generate-trip-day` Handler

### Root Cause (Confirmed)

The `generate-trip-day` handler (line 12949 in `index.ts`) is the actual orchestrator that runs day-by-day. It:
1. Does NOT extract `generationLogId` from params (line 12950)
2. Does NOT create an `innerTimer`
3. Does NOT call `updateProgress()` or `finalize()` anywhere
4. Does NOT pass `generationLogId` in the chain body to the next day (line 13422-13440)

The `generate-day` handler (line 7831) does create an `innerTimer` with local phase tracking, but only uses `startPhase`/`endPhase` (local-only) — never `updateProgress`. And the `generate-trip-day` handler that calls it has zero timer logic at all.

### Changes — Single file: `supabase/functions/generate-itinerary/index.ts`

**1. Extract `generationLogId` from params (line 12950)**

Add `generationLogId` to the destructured params.

**2. Create and resume timer after guards pass (~line 12959)**

```typescript
let innerTimer: GenerationTimer | null = null;
if (generationLogId) {
  try {
    innerTimer = new GenerationTimer(tripId, supabase);
    await innerTimer.resume(generationLogId, destination || '', totalDays || 1, travelers || 1);
  } catch (e) {
    console.warn('[generate-trip-day] Timer resume failed (non-blocking):', e);
    innerTimer = null;
  }
}
```

**3. Add `updateProgress` calls at key points:**

- After context loading / heartbeat update (~line 13052): `await innerTimer?.updateProgress(\`context_loaded_day_${dayNumber}\`, 10 + ((dayNumber - 1) / totalDays) * 80)`
- After AI call succeeds (~line 13123): `await innerTimer?.updateProgress(\`generated_day_${dayNumber}\`, 10 + ((dayNumber - 0.5) / totalDays) * 80)`
- After day saved to DB (line 13390 for last day, line 13414 for mid-chain): `await innerTimer?.updateProgress(\`saved_day_${dayNumber}\`, 10 + (dayNumber / totalDays) * 80)`

**4. Add `finalize('completed')` when all days done (line 13392):**

After the "generation complete" log, call `await innerTimer?.finalize('completed')`.

**5. Add `finalize('failed')` on permanent failure (line 13137):**

After logging permanent failure, call `await innerTimer?.finalize('failed')`.

**6. Pass `generationLogId` in chain body (line 13422-13440):**

Add `generationLogId,` to the chain body object so subsequent days can resume the same timer.

**7. Also pass `generationLogId` to the `generate-day` inner call (line 13086-13111):**

Add `generationLogId,` so the inner `generate-day` handler's `innerTimer` also connects to the same log row.

**8. Redeploy** the edge function.

### What This Fixes

After deployment, the `generation_logs` row will update in real-time as each day progresses through context loading, AI generation, and saving. The admin diagnostics page will show live phase progression and final duration/status instead of being permanently stuck at 10%.

