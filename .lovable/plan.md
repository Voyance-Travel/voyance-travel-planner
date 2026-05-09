## Fix R3.1 — Auto-refund Stripe when Viator booking fails

When `viator-book` gets a non-OK response from Viator's Partner API, the user has already paid via Stripe but the response only signals `refundRequired: true` — no actual refund happens. Issue the Stripe refund inline before returning, idempotent on `paymentId`.

### Change — `supabase/functions/viator-book/index.ts`

1. Add Stripe import at top: `import Stripe from "npm:stripe@18.5.0";` (matches `stripe-webhook`'s pinned version).
2. Replace the failure branch at lines 192–218 with:

```ts
if (!response.ok) {
  log("Viator booking error", { status: response.status, data });

  await serviceSupabase
    .from("trip_payments")
    .update({
      status: 'failed',
      metadata: {
        ...payment.metadata,
        viator_error: data.message || 'Booking failed',
        viator_error_code: data.code,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId);

  // Auto-refund the Stripe charge so the user isn't left out of pocket.
  let refundId: string | null = null;
  let refundError: string | null = null;
  if (payment.stripe_payment_intent_id) {
    try {
      const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2025-08-27.basil' });
      const refund = await stripe.refunds.create(
        {
          payment_intent: payment.stripe_payment_intent_id,
          reason: 'requested_by_customer',
          metadata: {
            activity_id: activityId,
            viator_error_code: data.code || 'unknown',
            auto_refund: 'viator_book_failure',
          },
        },
        { idempotencyKey: `viator-fail:${paymentId}` }
      );
      refundId = refund.id;
      log("Auto-refund issued", { refundId, amount: refund.amount });
    } catch (refundErr) {
      refundError = refundErr instanceof Error ? refundErr.message : String(refundErr);
      log("Auto-refund FAILED", { error: refundError, paymentId });
      // Don't throw — surface to user; ops handles manually.
    }
  } else {
    log("Auto-refund skipped: no stripe_payment_intent_id on payment", { paymentId });
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: data.message || `Viator booking failed: ${response.status}`,
      code: data.code,
      refundIssued: !!refundId,
      refundId,
      refundError,
    }),
    { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

Use API version `2025-08-27.basil` (project standard) rather than `2024-06-20`. The idempotency key `viator-fail:${paymentId}` prevents duplicate refunds on retry; Stripe's `charge.refunded` webhook handles downstream `trip_payments.status = 'refunded'` reconciliation.

### Known adjacent issue (not fixed in this round)

The existing failure branch writes `metadata: { ...payment.metadata, viator_error: ... }`, but `trip_payments` has **no `metadata` column** (verified via schema introspection). That `.update()` likely already errors silently — separate follow-up. Keeping the line as-is so this fix is purely additive; do not touch surrounding behavior.

### Out of scope

- Adding the missing `metadata` JSONB column to `trip_payments`.
- Refactoring the Stripe API version constant.
- Webhook-side handling of `charge.refunded` (already exists; verify only).
- The other R-series findings.

### Verification

1. Function deploys clean.
2. Trigger a Viator booking with an invalid `productCode` in test (or stub) → response includes `refundIssued: true, refundId: "re_..."`; Stripe dashboard shows the refund; re-invoking the same `paymentId` returns the same `refundId` (idempotent).
3. With no `STRIPE_SECRET_KEY` or a bogus payment intent → response includes `refundIssued: false, refundError: "..."` and edge logs show `Auto-refund FAILED`; the function still returns the original Viator error status (no 5xx).
