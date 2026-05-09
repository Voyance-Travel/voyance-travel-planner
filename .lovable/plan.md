## Fix R3.2 — Cancel Viator booking on Stripe refund

When `charge.refunded` fires in `stripe-webhook`, the local ledger and `trip_activities.booking_state` flip to `refunded`, but Viator's Partner API is never called. Vendor still considers the activity booked, and the company eats the refund cost. Add a vendor-cancel call inside the existing `charge.refunded` handler, after the booking-state transition.

### Critical schema correction vs. the suggested patch

The patch in the request looks up the booking ref via `trip_payments.metadata->>'viator_booking_ref'`, but **`trip_payments` has no `metadata` column** (verified — columns are `external_provider`, `external_booking_id`, `external_booking_url`, `stripe_*`, `status`, etc., no JSONB). It also has no `external_confirmation_number` despite `viator-book/index.ts:273` writing to that name — that update almost certainly errors silently today, so neither field is reliable.

`trip_activities`, however, has both `metadata jsonb` and `vendor_booking_id text`, and `transition_booking_state(p_metadata := viatorConfirmation)` is what stores the Viator confirmation payload (including `bookingRef`) on the activity row. So the canonical source for the Viator booking ref is `trip_activities` keyed by `activity_id`, not `trip_payments`.

### Change — `supabase/functions/stripe-webhook/index.ts` (~line 772, inside `charge.refunded`, immediately after the `transition_booking_state` RPC)

```ts
if (activityId) {
  await supabaseAdmin.rpc('transition_booking_state', {
    p_activity_id: activityId, p_new_state: 'refunded',
    p_trigger_source: 'stripe_webhook', p_trigger_reference: latestRefund?.id,
    p_metadata: { refund_amount: charge.amount_refunded },
  });

  // ── NEW: vendor-side Viator cancellation ──
  try {
    const { data: activityRow } = await supabaseAdmin
      .from('trip_activities')
      .select('id, metadata, vendor_booking_id')
      .eq('id', activityId)
      .maybeSingle();

    // Prefer the explicit bookingRef written by viator-book; fall back to vendor_booking_id.
    const meta = (activityRow?.metadata ?? {}) as Record<string, any>;
    const viatorBookingRef: string | undefined =
      meta.bookingRef || meta.viator_booking_ref || activityRow?.vendor_booking_id || undefined;

    // Skip silently if it's not a Viator booking (no ref persisted).
    if (viatorBookingRef && !meta.vendor_cancelled_at) {
      const apiKey = Deno.env.get('VIATOR_API_KEY');
      if (!apiKey) {
        logError('VIATOR_API_KEY not set; cannot cancel vendor booking', { activityId, viatorBookingRef });
      } else {
        const resp = await fetch(
          `https://api.viator.com/partner/bookings/${encodeURIComponent(viatorBookingRef)}/cancel`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json;version=2.0',
              'Content-Type': 'application/json',
              'exp-api-key': apiKey,
            },
            body: JSON.stringify({ reason: 'CUSTOMER_REQUESTED' }),
          },
        );
        const bodyText = await resp.text();
        const nextMeta = {
          ...meta,
          ...(resp.ok
            ? { vendor_cancelled_at: new Date().toISOString(), vendor_cancel_response: bodyText.slice(0, 500) }
            : { vendor_cancel_failed: true, vendor_cancel_status: resp.status, vendor_cancel_error: bodyText.slice(0, 500), vendor_cancel_attempted_at: new Date().toISOString() }),
        };
        await supabaseAdmin.from('trip_activities').update({ metadata: nextMeta }).eq('id', activityId);
        if (resp.ok) log('Viator vendor cancellation succeeded', { activityId, viatorBookingRef });
        else logError('Viator vendor cancellation failed', { activityId, viatorBookingRef, status: resp.status });
      }
    } else if (!viatorBookingRef) {
      log('charge.refunded: no Viator booking ref on activity, skipping vendor cancel', { activityId });
    } else {
      log('charge.refunded: vendor already cancelled, skipping', { activityId, vendor_cancelled_at: meta.vendor_cancelled_at });
    }
  } catch (cancelErr) {
    logError('Viator cancel exception', { activityId, error: cancelErr instanceof Error ? cancelErr.message : String(cancelErr) });
    // Never throw — webhook must still 200 to Stripe.
  }
}
```

### Idempotency

- `meta.vendor_cancelled_at` short-circuits duplicate webhook deliveries.
- Viator's cancel endpoint is itself idempotent on booking ref (returns "already cancelled" on re-call), so the worst case on a race is one wasted HTTP call.
- The duplicate-refund guard already at the top of the handler (`finance_ledger_entries` lookup by `stripe_refund_id`) means the whole block is also reached only once per refund event in normal flow.

### Known adjacent bugs (NOT fixed in this round — flagged for follow-up)

1. **`trip_payments` has no `metadata` column.** `viator-book/index.ts` writes `metadata: { ..., viator_booking_ref, viator_ref, ... }` and an `external_confirmation_number` field that also doesn't exist. These updates likely fail and the data never persists. Consequence: `trip_payments` cannot be a fallback source for the booking ref. (This fix relies on `trip_activities.metadata` instead, which IS populated correctly via `transition_booking_state(p_metadata := viatorConfirmation)`.)
2. **`transition_booking_state` requires `auth.uid()`** and webhooks run as service role with `auth.uid() = NULL`, so the existing RPC call inside `charge.refunded` returns `{success:false, error:'Authentication required'}`. The Stripe webhook's earlier `booked_confirmed` transition (R3.0) has the same issue. Separate fix.

Both are real and worth their own rounds, but adding them here would balloon scope.

### Out of scope

- Adding `metadata` JSONB to `trip_payments`.
- Reworking `transition_booking_state` to accept a service-role bypass.
- Cancelling on `charge.dispute.funds_withdrawn` or partial refunds (Viator cancel is all-or-nothing).
- Backfilling already-refunded bookings whose Viator side was never cancelled.

### Verification

1. Function deploys clean.
2. Trigger a successful Viator booking in test → confirm `trip_activities.metadata.bookingRef` is populated.
3. Refund the Stripe charge in the Stripe test dashboard → webhook fires → edge logs show `Viator vendor cancellation succeeded`; `trip_activities.metadata.vendor_cancelled_at` is set; Viator dashboard shows the booking cancelled.
4. Replay the same webhook event → logs show `vendor already cancelled, skipping`; no second Viator call (verify in edge function logs).
5. Refund a non-Viator activity (e.g. a manual booking with no `bookingRef`) → logs show `no Viator booking ref on activity, skipping vendor cancel`; webhook still 200s.
6. Simulate Viator 4xx (e.g. invalid ref) → `vendor_cancel_failed: true` + status/error stamped on `trip_activities.metadata`; webhook still 200s; ops can query for `metadata->>'vendor_cancel_failed' = 'true'` to find rows needing manual intervention.
