## RS.4 — Refund clawback handles partially-spent packs

**File:** `supabase/functions/stripe-webhook/index.ts` — credit-pack clawback inside `charge.refunded`, L932–L971.

Today, on refund we zero `credit_purchases.remaining` and log a single `stripe_refund` ledger row. If the user already burned some credits before the refund, our audit row understates the grant (only the unspent portion is reported as `credits_delta`) and there's no signal that the spent portion was forgiven. RS.4 makes the partial-spend case explicit and adds a structured ledger row + metadata for ops auditing. Policy (a) is baked in: spent credits are forgiven, never clawed from the user's free-tier balance.

### Schema

`credit_ledger.metadata jsonb DEFAULT '{}'` already exists. ✅
`uq_credit_ledger_stripe_session (stripe_session_id, transaction_type) WHERE stripe_session_id IS NOT NULL` is the idempotency backstop — we still only insert one `transaction_type='refund'` row per session, so the unique index isn't violated. ✅
No migration needed.

### Code change

Inside `if (!existingClawback) { … }` at L945, replace the body with:

```ts
// 1) Compute already-spent credits from this pack via the ledger
const { data: spentForSession } = await supabaseAdmin
  .from('credit_ledger')
  .select('credits_delta')
  .eq('stripe_session_id', checkoutSession.id)
  .eq('transaction_type', 'spend');
const totalSpentFromThisPack = (spentForSession || [])
  .reduce((sum, row) => sum + Math.abs(Number(row.credits_delta) || 0), 0);

// 2) Pack totals (granted vs remaining) for audit
const { data: purchaseRows } = await supabaseAdmin
  .from('credit_purchases')
  .select('id, remaining, amount')
  .eq('stripe_session_id', checkoutSession.id);
const totalGranted   = (purchaseRows || []).reduce((s, r) => s + Number(r.amount    || 0), 0);
const totalRemaining = (purchaseRows || []).reduce((s, r) => s + Number(r.remaining || 0), 0);

// 3) Zero remaining on every credit_purchases row for this session
for (const row of creditRows) {
  totalClawed += row.remaining;
  await supabaseAdmin
    .from('credit_purchases')
    .update({ remaining: 0, updated_at: new Date().toISOString() })
    .eq('id', row.id);
}

// 4) Single ledger audit row — branch on partial-spend
if (totalSpentFromThisPack > 0) {
  // Policy (a): forgive already-spent credits; only the unspent portion is clawed
  console.warn('[stripe-webhook] Refund on partially-spent pack — clawing back unspent only', {
    userId: refundUserId,
    sessionId: checkoutSession.id,
    totalGranted,
    totalRemaining,
    totalSpent: totalSpentFromThisPack,
  });
  await supabaseAdmin.from('credit_ledger').insert({
    user_id: refundUserId,
    transaction_type: 'refund',
    action_type: 'stripe_refund_partial_spent',
    credits_delta: -totalRemaining,
    is_free_credit: false,
    stripe_session_id: checkoutSession.id,
    notes: `Stripe refund on partially-spent pack. Clawed: ${totalRemaining}, already spent: ${totalSpentFromThisPack}, total granted: ${totalGranted}`,
    metadata: {
      total_granted: totalGranted,
      total_spent: totalSpentFromThisPack,
      total_clawed: totalRemaining,
      refund_id: refundRef,
    },
  });
} else {
  // Full claw-back, original ledger shape
  await supabaseAdmin.from('credit_ledger').insert({
    user_id: refundUserId,
    transaction_type: 'refund',
    action_type: 'stripe_refund',
    credits_delta: -totalClawed,
    is_free_credit: false,
    stripe_session_id: checkoutSession.id,
    notes: `Stripe refund clawback: ${totalClawed} credits (refund ${refundRef})`,
  });
}

// 5) Sync balance cache
await syncBalanceCache(supabaseAdmin, refundUserId);
log("Consumer credit clawback complete", {
  userId: refundUserId,
  creditsClawed: totalClawed,
  alreadySpent: totalSpentFromThisPack,
  refundId: refundRef,
});
```

The `else` branch (`existingClawback` exists → "Duplicate consumer credit clawback, skipping") at L969–L971 is unchanged.

### Notes

- `transaction_type='spend'` is the value emitted by the credit-deduction path (consistent with the negative `credits_delta` semantics elsewhere in this file). If the codebase actually uses a different label (e.g. `'usage'`), the partial-spend branch will silently report 0 spent and we'll always take the full-clawback path — safe but inaccurate. I'll spot-check existing inserts during implementation; if the term differs, I'll match it and call it out.
- Single ledger row per refund, so `uq_credit_ledger_stripe_session` is preserved.
- `totalRemaining` is computed over all rows for the session, while `totalClawed` is summed from `creditRows` (same filter `gt('remaining', 0)`); they're equal in practice, but the structured `metadata.total_clawed` uses `totalRemaining` to match the `credits_delta` exactly.

### Verify

```
grep -c "stripe_refund_partial_spent\|totalSpentFromThisPack" supabase/functions/stripe-webhook/index.ts
```
Expect ≥ 2.

### Out of scope
- Policy (b) (issue partial monetary refund proportional to unspent credits + treat the rest as debt).
- Backfilling existing refunded sessions with the new ledger shape.
- Frontend surfacing of "credits forgiven" in the receipt/history UI.
