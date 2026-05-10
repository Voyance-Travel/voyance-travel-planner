## Auto-summarize completed trips (close the trigger gap)

### Context

`summarize-trip-learnings` writes `trip_learnings.lessons_summary`, which `action-generate-trip.ts` reads to inject "learnings from past trips" into the next generation. Today it only fires from manual UI calls and (sometimes) from `post-trip-email`. If the email is opted-out, fails, or is never scheduled, the summary stays null forever.

Key contracts from the existing code:
- `summarize-trip-learnings/index.ts` expects body `{ tripId }` (camelCase, **not** `trip_id`/`user_id`) and requires an `Authorization: Bearer …` header (any non-empty bearer; we use service-role).
- `post-trip-email/index.ts` already runs with the service-role key in scope. It has three terminal paths: opt-out skip, "already sent" early-return, and the success path after `sendEmail`. We need to fire summarization on **all three** so opt-out users still get summarized.
- Cron jobs in this repo use `net.http_post` with the anon-key bearer baked into the migration (see `20260118193008_…`). We follow that exact pattern.

### Changes

**1. `supabase/functions/post-trip-email/index.ts`** — fire-and-forget summarization

Add a small helper at module scope:

```ts
async function triggerSummarization(supabase: any, tripId: string, source: string) {
  try {
    const { error } = await supabase.functions.invoke('summarize-trip-learnings', {
      body: { tripId },
    });
    if (error) console.error(`[post-trip-email] Summarization invoke failed (${source})`, error);
  } catch (err) {
    console.error(`[post-trip-email] Summarization invoke threw (${source})`, err);
    // Never fail the email flow — the daily cron is the safety net.
  }
}
```

Call it (awaited but inside try/catch so it can never throw upstream) at three exit points before returning the response:
- Right before the opt-out `return` (`source: 'opt_out'`).
- Right before the "already sent" `return` (`source: 'already_sent'`) — guarded by `forceResend === false` so we don't re-fire on resend storms; actually fine to always fire since `summarize-trip-learnings` is idempotent (upserts onto `trip_learnings`).
- Right before the success `return` after `trip_notifications` upsert (`source: 'after_email'`).

No retry logic — the daily cron handles persistent failures.

**2. New edge function `supabase/functions/summarize-trip-learnings-batch/index.ts`**

Service-role function, `verify_jwt = false` (default). Behavior:
- Find candidate trips: `trips` rows with `end_date < now() - interval '1 day'` (give the post-trip-email path 24h to land first) **left-joined** to `trip_learnings` where `lessons_summary IS NULL` — i.e., either no learning row yet, or one without a summary. Cap at **50 per run**, ordered by `end_date desc`.
- For each candidate: `await supabase.functions.invoke('summarize-trip-learnings', { body: { tripId: trip.id } })`. Run sequentially (not parallel) to keep memory/CPU bounded; each call is short.
- Aggregate `{ scanned, invoked, succeeded, failed }` and return as JSON. Log per-trip failures with `console.error` but never throw.
- Standard CORS + OPTIONS preflight, copy of the corsHeaders block used elsewhere.
- No auth check on the request itself (called by cron with anon bearer; logic uses service role internally). Returns 405 for non-POST.

Note on filter: `trip_learnings` is keyed by `trip_id` and may be missing entirely for some trips. The summarize function returns 404 ("Trip learning not found") in that case — we treat that as a benign skip in the batch's failure tally (count it as `skipped_no_learning`, not `failed`).

**3. New migration: daily cron sweep**

Follow the exact pattern of `20260118193008_…` (extensions guard + literal anon key in the SQL). Schedule: **`0 4 * * *`** (4am UTC daily, off-peak):

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'auto-summarize-completed-trips',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jsxplunjjvxuejeouwob.supabase.co/functions/v1/summarize-trip-learnings-batch',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <anon-key>"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);
```

(Anon key inlined as in the sibling migration; the function uses the service-role key from env for DB access.)

### Out of scope

- No change to `summarize-trip-learnings` itself.
- No backfill of existing completed trips (the cron will catch them on first run, capped at 50/day).
- No retry/backoff state machine — the cron's daily idempotency is sufficient given the LLM call is cheap and the candidate set drains over time.

### Verification

- `rg -n "summarize-trip-learnings" supabase/functions/post-trip-email/index.ts` → ≥1 hit (the new helper invocation).
- After deploy, manually invoke `summarize-trip-learnings-batch` and confirm the JSON response shows `scanned`/`invoked`/`succeeded`.
- Spot-check a completed trip: `select lessons_summary from trip_learnings where trip_id = …` is non-null after one cron cycle (or one post-trip-email run).
- `select * from cron.job where jobname = 'auto-summarize-completed-trips';` returns one row.