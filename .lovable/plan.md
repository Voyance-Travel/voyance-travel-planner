## RS.1 — Add `invoice.payment_failed` Stripe Webhook Handler

**Problem:** Failed recurring subscription payments currently leave users on premium tier without paying.

**Change:** Add a `case 'invoice.payment_failed'` block to `supabase/functions/stripe-webhook/index.ts`, placed alongside existing subscription handlers (`customer.subscription.deleted`, `customer.subscription.updated`, etc.).

**What the handler does:**
1. Extracts `subscription_id` from the invoice object.
2. Retrieves the Stripe subscription and resolves `user_id` from `sub.metadata.user_id`.
3. Determines if this is the final failed attempt (`attempt_count >= 4` or `sub.status === 'canceled'`).
4. Updates `user_tiers`:
   - `tier: 'free'` on final attempt (revokes premium).
   - `tier: 'past_due'` otherwise (grace period, Stripe will retry).
5. Stamps metadata: `payment_failed_at`, `attempt_count`, `next_retry_at`.
6. Logs the outcome via the existing `log()` helper.
7. Email notification is deferred (commented placeholder) — no template ready yet.

**Verification:** `grep -c "invoice.payment_failed" supabase/functions/stripe-webhook/index.ts` returns ≥ 1 after change.

**No other files touched.**