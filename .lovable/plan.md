## Round 1 — Critical Booking Confirmation Fix

Fix the ENUM mismatch that silently kills every Viator-activity Stripe booking confirmation, surface the swallowed RPC error, and backfill the stuck rows.

### Change 1 — `stripe-webhook/index.ts` (lines 285–291)

Replace the silent RPC call with a checked one using the correct ENUM value:

```ts
if (!updateError && payment?.external_provider === 'viator' && metadata.itemType === 'activity') {
  const { error: stateError } = await supabaseAdmin.rpc('transition_booking_state', {
    p_activity_id: metadata.itemId,
    p_new_state: 'booked_confirmed',
    p_trigger_source: 'stripe_webhook',
    p_trigger_reference: session.id,
    p_metadata: { payment_id: payment.id, stripe_session_id: session.id },
  });
  if (stateError) {
    console.error('[stripe-webhook] transition_booking_state failed:', stateError, { activityId: metadata.itemId });
  }
}
```

Two edits in one block:
- `'payment_confirmed'` → `'booked_confirmed'` (the only valid post-payment state in `booking_item_state`).
- Capture and `console.error` `stateError` so the next ENUM/transition regression isn't silent.

No other lines touched. The webhook still returns 200 to Stripe (intentional — never 5xx Stripe webhooks for downstream RPC issues), but failures will now appear in edge function logs.

### Change 2 — Backfill migration

One-shot migration that recovers every booking already stuck in `selected_pending` with a paid Viator activity payment. Uses the existing `transition_booking_state` RPC so audit logs (`booking_state_log` or equivalent) get the `manual_backfill` trigger source.

```sql
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT
      (tp.metadata->>'itemId')::uuid AS activity_id,
      tp.id AS payment_id,
      tp.stripe_checkout_session_id
    FROM public.trip_payments tp
    JOIN public.trip_activities ta
      ON ta.id = (tp.metadata->>'itemId')::uuid
    WHERE tp.status = 'paid'
      AND tp.external_provider = 'viator'
      AND tp.metadata->>'itemType' = 'activity'
      AND ta.booking_state = 'selected_pending'
  LOOP
    PERFORM public.transition_booking_state(
      p_activity_id    := r.activity_id,
      p_new_state      := 'booked_confirmed',
      p_trigger_source := 'manual_backfill',
      p_trigger_reference := r.stripe_checkout_session_id,
      p_metadata       := jsonb_build_object('payment_id', r.payment_id, 'reason', 'enum_bug_recovery')
    );
  END LOOP;
END $$;
```

Idempotent — re-running is a no-op once rows are advanced (state machine rejects same-state transitions or none remain matching the WHERE).

### Out of scope (deferred to Round 2+)

- The other 11 audit findings — none verified yet.
- Webhook 5xx behavior, retry policy, broader transition_booking_state hardening.
- Manual booking flow audit.
- Adding a non-Stripe path or alerting.

### Verification

1. Edge function deploys clean; no TS errors.
2. Trigger a Viator activity Stripe checkout in test mode → on `checkout.session.completed`, `trip_activities.booking_state` flips to `booked_confirmed`, `trip_payments.status = 'paid'`.
3. Confirm edge logs would have surfaced the prior bug: temporarily passing an invalid state in a scratch test logs `[stripe-webhook] transition_booking_state failed: …` (then revert).
4. After backfill: `SELECT count(*) FROM trip_payments tp JOIN trip_activities ta ON ta.id = (tp.metadata->>'itemId')::uuid WHERE tp.status='paid' AND tp.external_provider='viator' AND tp.metadata->>'itemType'='activity' AND ta.booking_state='selected_pending'` returns 0.
