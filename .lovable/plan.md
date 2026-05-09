## Fix 1.2 — Auto-refund Stripe on Viator booking failure

**Status: Already implemented.** No changes required.

### Verification

`supabase/functions/viator-book/index.ts` lines 193–250 already contain the exact logic specified:

- Top-of-file static import: `import Stripe from "npm:stripe@18.5.0";` (line 12) — using the file's existing import style, no dynamic `await import()` needed.
- `trip_payments` row marked `status: 'failed'` with `viator_error` / `viator_error_code` metadata (lines 197–208).
- Stripe refund created with:
  - `payment_intent: payment.stripe_payment_intent_id`
  - `reason: 'requested_by_customer'`
  - `metadata: { activity_id, viator_error_code, auto_refund: 'viator_book_failure' }`
  - `idempotencyKey: \`viator-fail:${paymentId}\`` — prevents double-refund on retry.
- Skips cleanly when `stripe_payment_intent_id` is missing (logs and continues).
- Catches refund errors, logs, surfaces `refundError` to caller without throwing.
- Response includes `success: false`, `error`, `code`, `refundIssued`, `refundId`, `refundError`.

Only nit vs. the spec text: API version pinned to `'2025-08-27.basil'` (project standard, per stripe-implementation guide) instead of `'2024-06-20'`. This matches the rest of the codebase and should be kept.

### Verify command

```
grep -n "stripe.refunds.create" supabase/functions/viator-book/index.ts
```

Expected: 1 hit at line 216, inside the `!response.ok` branch. ✅ Confirmed.

### Action

None — close ticket as already-done. Proceed to Fix 1.3 (`charge.refunded` webhook handler) which this fix is paired with.