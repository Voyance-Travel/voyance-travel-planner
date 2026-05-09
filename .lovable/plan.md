## RS.2 — Refund propagation to `activity_costs`

**File:** `supabase/functions/stripe-webhook/index.ts` — `charge.refunded` handler

Today, when Stripe fires `charge.refunded`, we transition booking state and trigger Viator cancellation, but the `activity_costs` row stays with `is_paid=true` / `paid_amount_usd=<original>`. The Payments tab + budget summary keep showing the activity as paid forever.

### Schema migration

`activity_costs` already has `is_paid`, `paid_amount_usd`, `paid_at`. Missing the columns the spec writes to. Migration:

```sql
ALTER TABLE public.activity_costs
  ADD COLUMN IF NOT EXISTS paid_amount_local numeric(10,2),
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_amount_cents integer;
```

No data backfill, no RLS changes (existing service-role + trip-owner policies cover the new columns).

### Code change

`supabase/functions/stripe-webhook/index.ts`, inside the `case "charge.refunded"` branch, immediately after the `transition_booking_state` RPC call at L834–L838 and before the Viator vendor-cancel `try` block at L840:

```ts
// Zero the activity cost so the budget summary reflects the refund.
// Without this, trip budgets show the cost as still-spent forever.
const { error: costErr } = await supabaseAdmin
  .from('activity_costs')
  .update({
    is_paid: false,
    paid_amount_usd: 0,
    paid_amount_local: 0,
    refunded_at: new Date().toISOString(),
    refund_amount_cents: charge.amount_refunded,
    updated_at: new Date().toISOString(),
  })
  .eq('activity_id', activityId);

if (costErr) {
  logError('Failed to zero activity_costs on refund', { activityId, error: costErr });
} else {
  log('activity_costs zeroed for refund', { activityId, refundAmount: charge.amount_refunded });
}
```

The existing `if (activityId)` guard (L833) already wraps this region, so no extra null check needed. Uses existing `log` / `logError` helpers for consistency with the rest of the handler.

Note: `activity_id` is a `text` column and the unique index is `(trip_id, activity_id)`. There's a tiny theoretical risk an activity_id collides across trips, but in practice the same Stripe charge maps to one trip's activity row. Spec says `.eq('activity_id', activityId)`; we keep that.

### Verify

```
grep -c "from('activity_costs').update.*is_paid: false" supabase/functions/stripe-webhook/index.ts
```
Expect ≥ 1.

### Out of scope
- Partial refunds (`amount_refunded < amount`) — spec zeroes regardless; matches the "zero the activity cost" comment. Future work could compute `paid_amount_usd = (amount - amount_refunded) / 100`.
- Frontend display of `refunded_at` badge — DB write only; UI consumes `is_paid=false` already.
- `trip_payments` row updates — already handled by existing webhook code paths and `transition_booking_state`.
