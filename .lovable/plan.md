## RS.6 — Persistence atomicity for itinerary save (v1: sync status flag)

Pragmatic v1: when the JSON write succeeds but the normalized-table sync fails, mark the trip so the frontend knows the normalized data is stale and falls back to `trips.itinerary_data` (the source of truth).

### Changes

**1. Migration** — add two columns to `public.trips`:
```sql
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS itinerary_sync_status text NOT NULL DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS itinerary_synced_at timestamptz;
```
CHECK constraint `itinerary_sync_status IN ('synced','pending','failed')`. Index optional (low-cardinality, low-volume reads).

**2. `supabase/functions/generate-itinerary/action-save-itinerary.ts` (lines 779–805)** — restructure the dual-write into 4 phases:
- Phase 1: `persistTripItinerary(...)` (unchanged — JSON source of truth).
- Phase 2: stamp `itinerary_sync_status='pending'`, `itinerary_synced_at=null`.
- Phase 3: call `handleSyncItineraryTables`. Inspect both the thrown-error path AND the existing `syncBody.success === false` path (current code only logs, doesn't surface). Treat either as failure. Never re-throw — JSON is durable.
- Phase 4: stamp `itinerary_sync_status` = `'synced'` (with `itinerary_synced_at = now()`) on success, or `'failed'` (with `itinerary_synced_at = null`) otherwise.

Uses the existing `supabase` client passed into the action (already service-role in this edge function), not a separate `supabaseAdmin`.

**3. Frontend read path** — out of scope for v1 unless requested. The flag is written; surfacing it in the UI/load path is a follow-up. (Spec says "Frontend... or trigger a re-sync" — phrased as optional.) I'll flag this in the plan note rather than touch frontend code, since the user's explicit "verify" criterion is just the grep against the edge function.

**4. Types regeneration** — automatic after migration; no manual edit to `src/integrations/supabase/types.ts`.

### Verify
- `grep -c "itinerary_sync_status" supabase/functions/generate-itinerary/action-save-itinerary.ts` → ≥ 2 (will be 3: pending stamp, synced stamp, failed stamp).
- Migration file present under `supabase/migrations/`.

### Notes / decisions
- Default `'synced'` so existing rows aren't flagged stale.
- No re-throw on sync failure — preserves current "non-fatal" semantics that the codebase already documents at line 803.
- Frontend fallback wiring deferred. Say the word and I'll add it (likely in the trip-load hook: if `itinerary_sync_status === 'failed'`, prefer `trips.itinerary_data` over the normalized tables, or fire a re-sync action).