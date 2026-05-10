## RS.L4 — Stripe webhook event observability

### Plan

**1. Migration** — create `public.stripe_webhook_log`:
```sql
CREATE TABLE IF NOT EXISTS public.stripe_webhook_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb,
  result text,                 -- 'received' | 'handled' | 'unhandled' | 'error'
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id)
);
CREATE INDEX IF NOT EXISTS idx_webhook_log_received
  ON public.stripe_webhook_log (received_at DESC);
ALTER TABLE public.stripe_webhook_log ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.stripe_webhook_log TO service_role;
```
RLS enabled, no policies → only `service_role` (which bypasses RLS) can read/write. Satisfies linter.

**2. Edit `supabase/functions/stripe-webhook/index.ts`:**

- After signature verification + `supabaseAdmin` creation (~line 181), insert a `received` log row. On `23505` (duplicate `event_id`), short-circuit return 200 — Stripe is retrying an already-processed event.
- After the `switch`, before the success response (line 1364), update the row to `result: 'handled'` (or `'unhandled'` if we hit the `default` branch — track via a local `let webhookResult = 'handled'` set to `'unhandled'` inside the `default` case).
- In the outer `catch` (line 1368), best-effort update to `result: 'error', error_message: message` (try/catch around it so logging failure doesn't mask the real error).

```ts
// after supabaseAdmin
const { error: logErr } = await supabaseAdmin
  .from('stripe_webhook_log')
  .insert({
    event_id: event.id,
    event_type: event.type,
    payload: { id: (event.data.object as any)?.id, type: event.type },
    result: 'received',
  });
if (logErr && (logErr as any).code === '23505') {
  log('Duplicate event ID — already processed', { eventId: event.id });
  return new Response('OK', { status: 200 });
}

let webhookResult: 'handled' | 'unhandled' = 'handled';
// ... switch ... in default: webhookResult = 'unhandled';

// before success response
await supabaseAdmin.from('stripe_webhook_log')
  .update({ result: webhookResult })
  .eq('event_id', event.id);
```

Outer catch:
```ts
try {
  await supabaseAdmin?.from('stripe_webhook_log')
    .update({ result: 'error', error_message: message })
    .eq('event_id', event?.id ?? '');
} catch { /* swallow */ }
```
(Note: `supabaseAdmin` and `event` need to be hoisted outside the inner `try` so the catch can reference them. Will declare them with `let` at the top of the handler.)

### Out of scope
- Backfilling historical events.
- Admin UI / dashboard for browsing the log (SQL query is enough for v1).
- Storing full payloads (privacy + size); keeping minimal `{id, type}` per the spec.

### Verification
- `ls supabase/migrations/ | grep stripe_webhook_log` → migration file present.
- `grep -c "stripe_webhook_log" supabase/functions/stripe-webhook/index.ts` ≥ 3 (insert + handled update + error update).
- Duplicate-event short-circuit returns 200 on retry (idempotency preserved).