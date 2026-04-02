

## Fix Stuck Itinerary Generation: Chain Recovery & Timeout Resilience

### Problem
The Rome trip (356229f2) is stuck at `itinerary_status: 'generating'` with 1/4 days complete. No `chain_error` was recorded. Two bugs cause this:

1. **Fatal error handler doesn't update trip status**: When `_handleGenerateTripDayInner` throws (line 137), the catch block logs the error and returns a 500 response, but never updates `itinerary_status` to `'failed'` or records `chain_error` in metadata. The trip stays stuck at `'generating'` forever with no diagnostic trail.

2. **Edge function timeouts kill silently**: If the function hits the platform timeout (~120s) during an AI call, the process is terminated before reaching either the chain code or the catch block. Nothing is written to the database.

### Changes

**1. `action-generate-trip-day.ts` — Fix fatal error handler (lines 135-151)**
- In the catch block, update the trip's `itinerary_status` to `'failed'` and write `chain_error` + `chain_broken_at_day` to metadata
- This ensures any caught exception leaves a diagnosable trail and unblocks the frontend recovery UI

**2. `action-generate-trip-day.ts` — Add pre-generation heartbeat with timeout sentinel**
- Before the AI call, write a "timeout sentinel" to metadata: `generation_timeout_sentinel: { day: N, started_at: timestamp }`
- Clear it after the day completes successfully
- The poller can detect an orphaned sentinel (started > 3 min ago) as evidence of a timeout kill

**3. `useGenerationPoller.ts` — Detect timeout-killed generations**
- Add a check: if `itinerary_status === 'generating'` and `generation_heartbeat` is stale (>5 min) and `chain_error` is null, treat as a silent timeout
- Auto-resume from `generation_completed_days + 1` (existing auto-resume logic already handles this, but the stale detection threshold may need tightening)
- Currently the poller relies on `chain_broken_at_day` which is never set in the timeout case — add heartbeat-stale as an independent stall signal

**4. Fix the stuck Rome trip**
- Create a one-time migration or manual update to set `itinerary_status = 'failed'` and `chain_error = 'silent_timeout_day_2'` on trip 356229f2, so the recovery UI appears

### Technical Detail

Fatal error handler fix:
```typescript
} catch (fatalErr) {
  console.error(`[generate-trip-day] FATAL error on day ${dayNumber}:`, fatalErr);
  timer.addError(`day_${dayNumber}_fatal`, String(fatalErr));

  // CRITICAL: Update trip status so it doesn't stay stuck at 'generating'
  try {
    const { data: currentTripData } = await supabase
      .from('trips').select('metadata').eq('id', tripId).single();
    const currentMeta = (currentTripData?.metadata as Record<string, unknown>) || {};
    await supabase.from('trips').update({
      itinerary_status: 'failed',
      metadata: {
        ...currentMeta,
        chain_broken_at_day: dayNumber,
        chain_error: `Fatal error on day ${dayNumber}: ${String(fatalErr).slice(0, 200)}`,
        generation_completed_days: dayNumber - 1,
        generation_heartbeat: new Date().toISOString(),
      },
    }).eq('id', tripId);
  } catch (metaErr) {
    console.error('[generate-trip-day] Failed to update failure metadata:', metaErr);
  }

  await timer.finalize('failed');
  return new Response(
    JSON.stringify({ error: String(fatalErr), status: 'failed', dayNumber }),
    { status: 500, headers: jsonHeaders }
  );
}
```

Poller stale-heartbeat detection (add alongside existing `chain_broken_at_day` check):
```typescript
// Detect silent timeout: generating + stale heartbeat + no chain_error
const heartbeat = meta.generation_heartbeat as string | undefined;
const heartbeatAge = heartbeat ? Date.now() - new Date(heartbeat).getTime() : Infinity;
const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
if (!isStalled && heartbeatAge > STALE_THRESHOLD && !meta.chain_error) {
  console.warn(`[useGenerationPoller] Silent timeout detected: heartbeat ${heartbeatAge}ms stale`);
  isStalled = true;
}
```

### Files

| File | Change |
|---|---|
| `supabase/functions/generate-itinerary/action-generate-trip-day.ts` | Fix fatal error handler to update trip status; add timeout sentinel |
| `src/hooks/useGenerationPoller.ts` | Add stale-heartbeat detection as independent stall signal |
| Migration (SQL) | Unstick Rome trip 356229f2 |

