## Fix 1.3 — Cancel Viator booking on Stripe refund

**Status: ~90% already implemented.** The Viator vendor-cancel call, idempotency stamp (`vendor_cancelled_at`), error metadata, and try/catch are all present at `supabase/functions/stripe-webhook/index.ts` lines 773–826. Only the **`activityId` fallback lookup** from the spec is missing.

### What's already there ✅
- `transition_booking_state` RPC call (line 767).
- Viator `POST /partner/bookings/{ref}/cancel` with `exp-api-key`, `version=2.0`, `CUSTOMER_REQUESTED` reason.
- Idempotency via `vendor_cancelled_at` check on existing metadata (line 785).
- Failure metadata: `vendor_cancel_failed`, `vendor_cancel_status`, `vendor_cancel_error`, `vendor_cancel_attempted_at`.
- try/catch that never throws (webhook always 200s).
- Note: Existing impl reads vendor ref + writes cancel state on the **`trip_activities`** row (richer source — has `vendor_booking_id` column + metadata). Spec read it from `trip_payments`. Keep the existing `trip_activities` path; it's strictly better.

### What's missing — single change

Add the activityId fallback before line 766's `if (activityId)` guard. Currently if `originalEntry.metadata.activity_id` is absent we silently skip; spec requires looking it up by `stripe_charge_id`.

**Edit** `supabase/functions/stripe-webhook/index.ts` lines 765 → replace:

```ts
const activityId = originalEntry.metadata?.activity_id;
```

with:

```ts
let activityId = originalEntry.metadata?.activity_id as string | undefined;

// Fallback: if metadata didn't carry activity_id, look it up by charge id.
if (!activityId) {
  const { data: paymentRow } = await supabaseAdmin
    .from('trip_payments')
    .select('metadata')
    .eq('stripe_charge_id', charge.id)
    .maybeSingle();
  const payMeta = (paymentRow?.metadata ?? {}) as Record<string, any>;
  activityId = payMeta.activity_id || payMeta.itemId;
  if (!activityId) {
    logError('charge.refunded with no activity_id — manual review needed', {
      chargeId: charge.id,
      refundId: latestRefund?.id,
    });
  }
}
```

(Uses existing `logError` helper instead of raw `console.warn` to match file conventions.)

### Verification

```bash
grep -n "viator-bookings.*cancel\|/cancel\|vendor_cancelled_at" supabase/functions/stripe-webhook/index.ts
```

Expected: ≥3 hits inside `charge.refunded` block (cancel URL, two `vendor_cancelled_at` references). Currently passing — will stay passing after edit.

Also confirm:
```bash
grep -n "stripe_charge_id" supabase/functions/stripe-webhook/index.ts
```
Should now show the fallback lookup added.

### Out of scope
- Vendor-side state for non-Viator providers (existing code already short-circuits on missing ref).
- Switching the cancel-state writeback from `trip_activities` to `trip_payments` (existing path is correct + richer).
- Webhook-replay idempotency on `transition_booking_state` itself (covered by R3.8 already shipped).