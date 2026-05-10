## INTEL-1 — Travel intel cache locking

### Schema reality vs spec

The actual `travel_intel_cache` schema differs from the spec snippet:
- Column is `intel_data`, not `payload`
- No `expires_at` column — staleness is checked by matching `destination`/`start_date`/`end_date`/`request_params` (lines 43-78)
- Cache hit returns a wrapped `{success, data, destination, dates, cached:true}` response, not the raw payload

The lock-table approach is independent of the cache schema and slots in cleanly between the existing cache-miss exit and the Perplexity call.

### Migration (new file)

```sql
CREATE TABLE IF NOT EXISTS public.travel_intel_locks (
  lock_key   text PRIMARY KEY,
  locked_at  timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

ALTER TABLE public.travel_intel_locks ENABLE ROW LEVEL SECURITY;
-- Service-role only; no client policies needed.

CREATE OR REPLACE FUNCTION public.cleanup_stale_intel_locks()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.travel_intel_locks WHERE expires_at < now();
$$;

SELECT cron.schedule(
  'cleanup-intel-locks',
  '*/5 * * * *',
  $$SELECT public.cleanup_stale_intel_locks()$$
);
```

`pg_cron` is already enabled in this project (used by `expire_stale_trip_payments` per memory). The cron job here invokes a pure-SQL function with no URL/anon-key — safe to ship in a migration (the schedule-jobs rule is only about jobs that embed user-specific URLs/keys via `net.http_post`).

### Edge function changes — `supabase/functions/generate-travel-intel/index.ts`

Adapted-to-actual-schema version. Only runs when `tripId` is provided (lock keyed on it); the existing `forceRefresh` path bypasses cache *and* lock since the user explicitly asked for a fresh result.

**Insert immediately before the `// ── No cache hit — call Perplexity ──` line (~line 80):**

```ts
// Acquire a generation lock keyed by tripId so concurrent callers wait for a
// single Perplexity round-trip instead of all paying the cost in parallel.
const lockKey = tripId ? `travel_intel_${tripId}` : null;
let lockAcquired = false;

if (lockKey && !forceRefresh) {
  const { error: claimErr } = await supabaseAdmin
    .from('travel_intel_locks')
    .insert({
      lock_key: lockKey,
      locked_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30_000).toISOString(),
    });

  if (claimErr && (claimErr as any).code === '23505') {
    // Another caller is generating. Poll the cache for up to 25s.
    console.log(`[travel-intel] Lock held by peer for ${tripId}, waiting…`);
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const { data: retryCache } = await supabaseAdmin
        .from('travel_intel_cache')
        .select('intel_data, destination, start_date, end_date, request_params')
        .eq('trip_id', tripId)
        .single();

      if (
        retryCache?.intel_data &&
        retryCache.destination === destination &&
        retryCache.start_date === startDate &&
        retryCache.end_date === endDate
      ) {
        return new Response(
          JSON.stringify({
            success: true,
            data: retryCache.intel_data,
            destination: country ? `${destination}, ${country}` : destination,
            dates: { startDate, endDate },
            cached: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    console.warn(`[travel-intel] Peer lock holder for ${tripId} did not produce cache; proceeding ourselves.`);
    // Fall through — peer failed; we'll generate without holding the lock (the stale row will be auto-cleaned).
  } else if (claimErr) {
    console.warn('[travel-intel] Lock insert failed, continuing without lock:', claimErr);
  } else {
    lockAcquired = true;
  }
}
```

**Wrap the rest of the function (Perplexity call + parse + cache upsert + every `return new Response(...)` from line 82 to the JSON-parse error fallback at ~line 313) in `try { … } finally { release lock }`.**

The simplest mechanical approach: introduce a `releaseLock` helper and call it before every existing `return` statement past the lock acquisition, plus inside the outer `catch (error)` block. Concretely:

```ts
const releaseLock = async () => {
  if (lockAcquired && lockKey) {
    await supabaseAdmin.from('travel_intel_locks').delete().eq('lock_key', lockKey);
    lockAcquired = false;
  }
};
```

Then before each downstream `return new Response(...)` and at the start of the outer `catch`, call `await releaseLock();`. This avoids re-indenting ~230 lines and survives the early returns the function already uses (Perplexity 429, Perplexity 500, parse failure, generic error). Five call sites identified:
1. Perplexity 429 branch
2. Perplexity non-OK branch
3. Successful cache-upsert + response branch
4. Parse-failure fallback response
5. Outer `catch (error)` handler

### Verification
- `grep -c "travel_intel_locks\|lock_key" supabase/functions/generate-travel-intel/index.ts` → ≥ 2 (spec floor)
- Migration file present and applied; `travel_intel_locks` table + `cleanup_stale_intel_locks()` + `cleanup-intel-locks` cron job all exist
- Concurrent calls for the same `tripId`: only one fires Perplexity; others wait ≤25s and return the cached result
- `forceRefresh=true` and tripId-less calls bypass the lock entirely (no behavioral change)

### Out of scope
- Re-architecting the cache schema to use `expires_at` (spec assumed it; current schema doesn't and rewriting it is a separate concern)
- Changing the cache-hit param-matching logic
- Lock holder failure notifications to the waiter (the 25s poll + fall-through is sufficient per spec)
