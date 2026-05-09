## Fix 1.4 — Cancellation policy enforcement

**Status: Already fully implemented.** No code changes required.

### What's in place

**`src/services/bookingEngine.ts` lines 746–788** (`cancelBooking`):
- Loads booking via `getBookingById`; throws if not found.
- Policy gate: refuses cancel when `cancellationPolicy.deadline < now()` (line 755).
- `computeAllowedRefund` helper (line 736) enforces refund-percentage + fees ceiling; rejects requests over policy max (line 761) — stricter than spec.
- Stripe-backed branch invokes `refund-booking` edge function with `bookingId, paymentIntentId, amountCents, reason`; webhook (Fix 1.3) handles vendor cancel + state transition.
- Free / non-Stripe branch transitions locally via `updateBookingStatus`.

**`supabase/functions/refund-booking/index.ts`** (102 lines):
- CORS preflight + standard project headers.
- Auth: validates JWT via anon-key client; returns 401 if missing/invalid.
- Validation: requires `bookingId`, `paymentIntentId`, positive numeric `amountCents`.
- Server-side ownership check via service-role client (`booking.user_id !== user.id` → 403) — defense layer the spec didn't require.
- Cross-checks `paymentIntentId` matches the booking row.
- Caps `amountCents` at `booking.price_cents`.
- Idempotent short-circuit if `status` already `refunded`/`cancelled`.
- `stripe.refunds.create` with `reason: 'requested_by_customer'`, metadata `{booking_id, source, user_reason}`, idempotency key `booking-cancel:${bookingId}:${amountCents}`.
- Uses project-standard imports (`npm:stripe@18.5.0`, `apiVersion: '2025-08-27.basil'`) instead of spec's `esm.sh` + `2024-06-20`.

### Verification — passes

```
$ ls supabase/functions/refund-booking/
index.ts

$ grep -n "refund-booking\|cancellationPolicy" src/services/bookingEngine.ts
… line 768 → supabase.functions.invoke('refund-booking', …)
… lines 737, 754 → cancellationPolicy.deadline gate
```

### Action

None — close as already-shipped. Proceed to next ticket.