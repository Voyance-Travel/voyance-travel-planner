

## Fix Generation Logging Stuck at `pre_chain_setup` 10%

### Root Cause
The self-chaining architecture has **one timer per invocation**: `action-generate-trip.ts` creates the log row and updates to 5%, then `action-generate-trip-day.ts` resumes that timer via `generationLogId`. The happy-path last-day completion **does** call `timer.finalize('completed')` (line 861). But there are **4 exit paths that skip finalize entirely**:

1. **All days failed** (line 426) — returns without finalize
2. **Partial failure on last day** (line 487) — returns without finalize  
3. **Chain failure** (line 981) — chain to next day fails, returns without finalize
4. **Skip-to-chain for failed day** (line 495) — chains without finalize (not terminal, but if the chain itself then fails, the timer is lost)

Additionally, intermediate `updateProgress` calls only happen at two points: once at 5% in the orchestrator and once per completed day (line 925). No progress updates exist for prompt building, enrichment, or post-processing phases.

### Changes

**1. `action-generate-trip-day.ts` — Add `timer.finalize()` to all terminal exit paths**

- **Line ~427** (all days failed path): Add `await timer.finalize('failed');` before the return
- **Line ~488** (partial/last day with failures): Add `await timer.finalize('failed');` before the return
- **Line ~981-1004** (chain failure): Add `await timer.finalize('failed');` after recording chain_broken metadata — this is a non-terminal path (current day succeeded but next day can't start), so finalize with `'completed'` if `dayNumber === totalDays - 1` equivalent logic, otherwise `'failed'`

**2. `action-generate-trip-day.ts` — Add intermediate `updateProgress` calls**

- After loading multi-city mapping (~line 200): `await timer.updateProgress('context_loaded', 10 + ...)`
- Before the AI call attempt loop (~line 286): progress update with day info
- These complement the existing per-day-complete update at line 925

**3. `action-generate-trip.ts` — Add `updateProgress` after enrichment completes**

- After `timer.endPhase('pre_chain_enrichment')` (line 443): `await timer.updateProgress('enrichment_complete', 8);`

**4. Database cleanup — Mark stuck rows as completed**

Run a migration to clean up existing stuck `in_progress` rows older than 30 minutes:

```sql
UPDATE generation_logs
SET status = 'completed',
    current_phase = 'done (retroactive fix)',
    progress_pct = 100
WHERE status = 'in_progress'
  AND created_at < now() - interval '30 minutes';
```

**5. Redeploy** the `generate-itinerary` edge function.

### Why This Fixes It
The stuck log was likely caused by hitting one of the non-finalized exit paths (e.g., chain failure or partial completion). Adding `finalize()` to every terminal return ensures the log row always reaches a final state. The intermediate progress calls provide visibility into what phase the generation is actually in.

