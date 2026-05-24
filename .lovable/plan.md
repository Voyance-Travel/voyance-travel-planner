## Goal
Stop initial itinerary generation from silently failing into stuck/partial trips. Every paid generation must leave a durable, DB-stored trace so we can answer "what happened?" from the trip row alone — even when edge logs are missing.

## What shipped (2026-05-24)

### 1. Durable generation trace
- New shared helper `supabase/functions/_shared/generation-trace.ts`:
  - `appendGenerationTrace(supabase, tripId, event)` — best-effort writer to `trips.metadata.generation_trace` (ring buffer cap 80).
  - Mirrors a single-line `[GENTRACE]` console sentinel for log shipping.
  - Never throws — generation cannot be broken by a bad trace write.
  - `writeGenerationHealth()` for terminal-state snapshot.
- Tests: `supabase/functions/_shared/__tests__/generation-trace.test.ts` (append, ring-buffer cap, error truncation, never-throws).

### 2. Trace wired at the high-value boundaries
- `action-generate-trip.ts`:
  - `launcher_received`, `launcher_metadata_init`, `launcher_background_started`, `launcher_background_failed`.
- `action-generate-trip-day.ts`:
  - `day_started` at the top of each day.
  - `day_persisted_json` after the intermediate persist.
  - `chain_finalized` at the final-leg persist (with `finalStatus`, `isComplete`, empty days).
  - `day_chain_failed` when the chain-to-next-day call exhausts retries.
- `action-save-itinerary.ts`:
  - `persist_gate_checked` on pass.
  - `persist_gate_blocked` per offending `{day, code, message}` (capped at 20 per write) so post-mortem reveals WHICH day + WHICH rule blocked.

### 3. Recovery hole closed
- TripDetail self-heal already widened (Bangkok/Dubai class) to rebuild JSON from normalized tables when status is `partial`/`failed`/stale-`generating` and tables look complete. Reused unchanged.
- One-shot backfill (`supabase/migrations/.../backfill_2026_05_24_status_promote`) promoted every trip whose normalized tables already cover the expected day count with real activities. Recovered: Dubai, Bangkok, Singapore, Aruba, and ~15 sibling stuck trips. Frontend self-heal fills any missing JSON gaps on next load.

### 4. Read path for future incidents
Any future stuck trip can be debugged by selecting one column:

```sql
select id, destination, itinerary_status,
       metadata->'generation_trace' as trace,
       metadata->'generation_health' as health
from trips
where id = '...';
```

Phases tell us, in order, whether the failure is AI, validation, persist, chain, or finalize.

## Open follow-ups

- `writeGenerationHealth` is implemented but only the trace events are wired so far. Wire the snapshot at chain-final / launcher-failed in a follow-up pass.
- `recoverGenerationFromTables` from the frontend service can be reused server-side as a backfill RPC (not yet split out).
- Add a small `metadata.generation_trace` viewer to the admin tools so support can read it without SQL.
