## RS.3 — `payment_intent.payment_failed` + `payment_intent.canceled` handlers

**File:** `supabase/functions/stripe-webhook/index.ts` — insert two new cases before `default:` (line 1168).

### Schema gap

Neither `trip_payments` nor `pending_credit_charges` currently has a `metadata jsonb` column, but the spec writes to `payment.metadata` on both and filters `pending_credit_charges.metadata->>stripe_payment_intent_id`. Without the column the handler would 500.

`trip_payments.status` check-constraint already permits `'failed'` and `'cancelled'`. ✅
`pending_credit_charges.status` check-constraint already permits `'failed'`. ✅

### Migration

```sql
ALTER TABLE public.trip_payments
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.pending_credit_charges
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_pending_credit_charges_pi
  ON public.pending_credit_charges ((metadata->>'stripe_payment_intent_id'))
  WHERE metadata ? 'stripe_payment_intent_id';
```

No RLS changes (existing policies cover new columns). The partial index keeps the `.filter('metadata->>stripe_payment_intent_id', 'eq', pi.id)` lookup cheap once charge-creation flows start writing the PI id into metadata. (Populating it at write time is out of scope here; current charges won't match the filter, which is the safe no-op.)

### Code change

`supabase/functions/stripe-webhook/index.ts`, immediately before `default:` at L1168:

```ts
case "payment_intent.payment_failed": {
  const pi = event.data.object as Stripe.PaymentIntent;
  const lastErr = pi.last_payment_error;
  log('payment_intent.payment_failed', {
    paymentIntentId: pi.id,
    code: lastErr?.code,
    declineCode: lastErr?.decline_code,
    message: lastErr?.message,
  });

  const { data: payment } = await supabaseAdmin
    .from('trip_payments')
    .select('id, metadata')
    .eq('stripe_payment_intent_id', pi.id)
    .maybeSingle();

  if (payment) {
    await supabaseAdmin.from('trip_payments').update({
      status: 'failed',
      metadata: {
        ...(payment.metadata || {}),
        stripe_failure_code: lastErr?.code,
        stripe_failure_decline_code: lastErr?.decline_code,
        stripe_failure_message: lastErr?.message,
        failed_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    }).eq('id', payment.id);
  }

  const userId = (pi.metadata?.user_id || pi.metadata?.userId) as string | undefined;
  if (userId) {
    await supabaseAdmin.from('pending_credit_charges')
      .update({
        status: 'failed',
        resolved_at: new Date().toISOString(),
        resolution_note: `Stripe payment failed: ${lastErr?.code || 'unknown'}`,
      })
      .eq('user_id', userId)
      .eq('status', 'pending')
      .filter('metadata->>stripe_payment_intent_id', 'eq', pi.id);
  }
  break;
}

case "payment_intent.canceled": {
  const pi = event.data.object as Stripe.PaymentIntent;
  log('payment_intent.canceled', { paymentIntentId: pi.id, reason: pi.cancellation_reason });
  await supabaseAdmin.from('trip_payments').update({
    status: 'cancelled',
    metadata: {
      cancellation_reason: pi.cancellation_reason,
      cancelled_at: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  }).eq('stripe_payment_intent_id', pi.id);
  break;
}
```

Note on `payment_intent.canceled`: spec overwrites `metadata` instead of merging. Keeping spec verbatim — cancellation is terminal so prior metadata loss is acceptable; if you'd rather merge, easy follow-up.

### Verify

```
grep -c "payment_intent.payment_failed\|payment_intent.canceled" supabase/functions/stripe-webhook/index.ts
```
Expect ≥ 2.

### Out of scope
- Frontend polling/realtime listener for `trip_payments.status='failed'` to surface "card declined" toast — spec mentions it, but that's a separate UI task.
- Backfilling `metadata.stripe_payment_intent_id` into `pending_credit_charges` at charge-creation time (book-activity / create-booking-checkout) — needed for the PI-filter lookup to actually match rows. Can be a follow-up; today's handler is a safe no-op until then.
