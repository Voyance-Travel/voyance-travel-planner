## Fix R3.3 — Cancellation policy enforcement

`bookingEngine.cancelBooking()` is currently a pure state-setter — no policy gate, no Stripe refund, no Viator cancel. Add the policy check, route refunds through a new server-side `refund-booking` edge function, and let the existing `charge.refunded` webhook (R3.2) do the vendor-side cancel and final state transition.

### ⚠️ Important finding before we change anything

This module appears to be dead/vestigial code, and you should decide whether to fix it or delete it:

1. **`public.bookings` table does not exist.** `bookingEngine` reads/writes `supabase.from('bookings')` cast to `any`, so every call would throw at runtime today. (`select to_regclass('public.bookings')` → null.)
2. **No UI calls `bookingEngine.cancelBooking`.** The only `useCancelBooking` import in the app (`BookableItemCard.tsx:36`) comes from `bookingStateMachine.ts`, which operates on `trip_activities` (the real booking surface, alongside `trip_payments`). The webhook-side cancel R3.2 already handles that path end-to-end.

So the R3.3 patch as written hardens a code path that does not run in production. Two options:

- **Option A — implement R3.3 as requested.** Useful if `bookings` is planned to be re-introduced or there's an out-of-tree consumer. Adds the `refund-booking` edge function which is reusable.
- **Option B — delete `cancelBooking` (and ideally the rest of the dead `bookings`-table-backed surface) from `bookingEngine.ts`.** Cleaner. Real cancellation already works via `bookingStateMachine` + webhook.

**Plan below assumes Option A** because that's what was requested. If you want B instead, say the word and I'll switch.

---

### Change 1 — New edge function `supabase/functions/refund-booking/index.ts`

Server-side wrapper around `stripe.refunds.create` with auth, ownership check, and idempotency. Mirrors the pattern used in `viator-book` (`npm:stripe@18.5.0`, API `2025-08-27.basil`).

```ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import Stripe from "npm:stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization" }, 401);

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { bookingId, paymentIntentId, amountCents, reason } = body ?? {};
    if (!bookingId || !paymentIntentId || typeof amountCents !== "number" || amountCents <= 0) {
      return json({ error: "bookingId, paymentIntentId, amountCents required" }, 400);
    }

    // Service-role: ownership / sanity check on the booking row.
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: booking, error: bErr } = await service
      .from("bookings")
      .select("id, user_id, stripe_payment_intent_id, total_amount_cents, status")
      .eq("id", bookingId)
      .maybeSingle();
    if (bErr || !booking) return json({ error: "Booking not found" }, 404);
    if (booking.user_id !== user.id) return json({ error: "Forbidden" }, 403);
    if (booking.stripe_payment_intent_id !== paymentIntentId) {
      return json({ error: "paymentIntentId mismatch" }, 400);
    }
    if (amountCents > (booking.total_amount_cents ?? 0)) {
      return json({ error: "amountCents exceeds booking total" }, 400);
    }
    if (booking.status === "refunded" || booking.status === "cancelled") {
      return json({ ok: true, already: true }, 200);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
    const refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        amount: amountCents,
        reason: "requested_by_customer",
        metadata: { booking_id: bookingId, source: "refund-booking", user_reason: String(reason ?? "").slice(0, 200) },
      },
      { idempotencyKey: `booking-cancel:${bookingId}:${amountCents}` },
    );

    return json({ ok: true, refundId: refund.id, amount: refund.amount, status: refund.status }, 200);
  } catch (err) {
    console.error("[refund-booking]", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
```

### Change 2 — `src/services/bookingEngine.ts` `cancelBooking` (lines 736–747)

Add a `computeAllowedRefund` helper just above `cancelBooking`, then rewrite the function:

```ts
export function computeAllowedRefund(booking: Booking): number {
  const policy = booking.cancellationPolicy;
  const total = booking.totalAmountCents ?? 0;
  if (!policy) return 0;
  if (policy.deadline && new Date(policy.deadline) < new Date()) return 0;
  const pct = Math.max(0, Math.min(100, policy.refundPercentage ?? 0));
  const fees = Math.max(0, policy.feesCents ?? 0);
  return Math.max(0, Math.round((total * pct) / 100) - fees);
}

export async function cancelBooking(
  bookingId: string,
  reason: string,
  refundAmountCents?: number,
): Promise<Booking> {
  const booking = await getBookingById(bookingId);
  if (!booking) throw new Error(`Booking ${bookingId} not found`);

  const policy = booking.cancellationPolicy;
  if (policy?.deadline && new Date(policy.deadline) < new Date()) {
    throw new Error(`Cancellation window has passed (deadline: ${policy.deadline})`);
  }

  const allowedRefund = computeAllowedRefund(booking);
  const requested = refundAmountCents ?? allowedRefund;
  if (requested > allowedRefund) {
    throw new Error(`Requested refund ${requested}¢ exceeds policy max ${allowedRefund}¢`);
  }

  // Stripe-backed: delegate to edge function. The charge.refunded webhook (R3.2)
  // will cancel the vendor booking and transition booking_state to refunded.
  if (booking.stripePaymentIntentId && requested > 0) {
    const { error } = await supabase.functions.invoke('refund-booking', {
      body: {
        bookingId,
        paymentIntentId: booking.stripePaymentIntentId,
        amountCents: requested,
        reason,
      },
    });
    if (error) throw new Error(`Refund failed: ${error.message}`);
    // Webhook completes the local transition asynchronously. Return the
    // current booking; UI should refetch on the booking-changed signal.
    return booking;
  }

  // Free / non-Stripe-backed: cancel locally only.
  return updateBookingStatus(bookingId, 'cancelled', {
    cancelledAt: new Date().toISOString(),
    cancellationReason: reason,
    refundAmountCents: requested,
    refundStatus: requested > 0 ? 'pending' : undefined,
  });
}
```

`Booking` already has `cancellationPolicy`, `stripePaymentIntentId`, and `totalAmountCents` (verified on lines 276/281 etc.), so no type changes.

### Out of scope

- Resurrecting / migrating the `bookings` table (Option B is the cleaner fix; flagged above).
- Updating `bookingStateMachine.cancelBooking` — that's the live path the UI actually uses; if you want the same gating + Stripe refund there, that's a separate round (and the sanest one to do).
- Modification (reschedule) policy enforcement.
- Partial / multi-leg refunds.

### Verification

1. Edge function deploys clean; `curl_edge_functions` with bogus body → 400.
2. Calling `cancelBooking(id, reason)` past the policy deadline → throws `Cancellation window has passed (...)`.
3. With a valid Stripe payment intent and a Viator activity, `cancelBooking` → `refund-booking` returns `refundId`; Stripe dashboard shows refund; webhook (R3.2) fires; `trip_activities.metadata.vendor_cancelled_at` set; booking row status flips to `refunded`.
4. Replay `cancelBooking` on the same booking → idempotency key returns the same `refundId`; no duplicate refund.
5. Free booking (`stripePaymentIntentId` null) → local-only `cancelled` transition; no edge call.
6. Refund amount > `computeAllowedRefund` → throws before any Stripe call.

If you'd rather take Option B (delete the dead `bookings` surface and apply R3.3 to `bookingStateMachine` instead), tell me and I'll re-plan against the live code path.
