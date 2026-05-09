## Fix 6.2 — viator-book silent RPC error path

**File:** `supabase/functions/viator-book/index.ts` (lines 308–314, the post-booking `transition_booking_state` call)

**Problem:** RPC call is awaited without error capture. If the state transition fails (stale ID, RLS, ENUM regression) after a successful Viator booking, the function still returns `success: true` with no observability — local state stays out of sync with Viator. Same class as the booking ENUM bug fixed in S1.1 round (`stripe-webhook` line 287).

**Change:** Capture `{ error: stateError }` from the RPC. If non-null:
1. `console.error('[viator-book] transition_booking_state failed AFTER successful booking:', stateError, { activityId, viatorRef })` so ops can grep logs.
2. Stamp `trip_payments.metadata` with `state_transition_failed: true`, `state_transition_error: stateError.message`, `state_transition_failed_at: <iso>` — preserving the existing `payment.metadata` spread + `viatorConfirmation` so the voucher data we already wrote isn't lost.
3. **Do NOT throw** — Viator booking is real, voucher exists, user paid; only local state is broken. Function still returns `success: true` so the user sees the voucher.

`payment.metadata` is already in scope (used at line 275). `paymentId` is in scope. Mirrors the stripe-webhook pattern exactly.

### Verification

```
grep -n "stateError\|state_transition_failed" supabase/functions/viator-book/index.ts
```

Expected: 3+ hits (destructure + console.error + 3 metadata keys).
