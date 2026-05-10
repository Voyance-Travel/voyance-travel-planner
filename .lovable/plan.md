## RS.M.P5 — Subscription created/updated real handling

### Findings
- `customer.subscription.deleted` (lines 1166–1206) already handles cancellation: zero club credits, audit ledger row, `upsertUserTier(... 'free', allowDowngrade: true)`, sync balance.
- `customer.subscription.created`/`updated` (lines 1213–1218) is a no-op log stub.
- `user_tiers` columns today: `user_id, tier, first_purchase_at, highest_purchase, updated_at`. Missing `stripe_subscription_id`, `subscription_status`, `current_period_end` → migration needed.
- `tier` has a CHECK constraint restricting it to `free|flex|voyager|explorer|adventurer` — `'voyager'` (the spec default) is valid.
- Existing helpers available: `upsertUserTier(...)` (handles upgrade/downgrade gating), `syncBalanceCache(...)`, `resolveUserIdFromCustomer(...)`, `log(...)`, `logError(...)`.

### Plan

**1. Migration — add subscription tracking columns to `user_tiers`**

```sql
ALTER TABLE public.user_tiers
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status   text,
  ADD COLUMN IF NOT EXISTS current_period_end    timestamptz;

CREATE INDEX IF NOT EXISTS idx_user_tiers_stripe_sub
  ON public.user_tiers (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
```

No RLS change (existing "Users can read own tier" SELECT policy already covers the new columns; writes stay service-role-only).

**2. Replace stub at lines 1213–1218 with real handler** (`supabase/functions/stripe-webhook/index.ts`)

```text
case "customer.subscription.created":
case "customer.subscription.updated": {
  const sub = event.data.object as Stripe.Subscription;

  // Resolve user_id (metadata first, customer-email fallback — same pattern as deleted)
  let userId = (sub.metadata?.user_id || sub.metadata?.userId) as string | undefined;
  if (!userId) {
    const fb = await resolveUserIdFromCustomer(supabaseAdmin, stripe, sub.customer as string);
    if (fb) userId = fb;
  }
  if (!userId) {
    log('subscription.created/updated: cannot resolve userId — skipping', { subId: sub.id });
    break;
  }

  const status = sub.status;
  const tier = (sub.metadata?.tier || sub.metadata?.club_tier || 'voyager') as string;
  const periodEndIso = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;

  if (status === 'active' || status === 'trialing') {
    // Use upsertUserTier (no-downgrade) so a paused/downgraded plan can't drop tier;
    // initial grants stay owned by checkout.session.completed.
    await upsertUserTier(supabaseAdmin, userId, tier);

    // Stamp subscription tracking columns directly (the helper doesn't touch them)
    await supabaseAdmin.from('user_tiers').update({
      stripe_subscription_id: sub.id,
      subscription_status: status,
      current_period_end: periodEndIso,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);

    log('Subscription active/trialing — tier + status updated', { userId, tier, status, subId: sub.id });

  } else if (status === 'past_due' || status === 'incomplete' || status === 'incomplete_expired') {
    // Don't revoke — Stripe retries renewals for ~3 weeks. Just stamp status for UI.
    await supabaseAdmin.from('user_tiers').update({
      subscription_status: status,
      current_period_end: periodEndIso,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);

    log('Subscription needs attention — flagged for UI notice', { userId, status, subId: sub.id });

  } else if (status === 'canceled' || status === 'unpaid') {
    // Treat like deleted: zero club credits, force-downgrade tier, sync balance.
    await supabaseAdmin.from('credit_purchases')
      .update({ remaining: 0, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .in('credit_type', ['club_base', 'club_bonus']);

    await supabaseAdmin.from('credit_ledger').insert({
      user_id: userId,
      transaction_type: 'subscription_cancel',
      credits_delta: 0,
      is_free_credit: false,
      action_type: 'subscription_updated_canceled',
      notes: `Subscription ${sub.id} transitioned to ${status} — credits revoked`,
      metadata: { stripe_subscription_id: sub.id, status },
    });

    await upsertUserTier(supabaseAdmin, userId, 'free', { allowDowngrade: true });
    await supabaseAdmin.from('user_tiers').update({
      subscription_status: status,
      current_period_end: periodEndIso,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);

    await syncBalanceCache(supabaseAdmin, userId);
    log('Subscription canceled/unpaid — credits revoked', { userId, status, subId: sub.id });

  } else {
    // paused, etc. — observe only
    log('Subscription event — observed (no action)', { userId, status, subId: sub.id });
  }

  break;
}
```

### Why this shape
- Reuses the existing `upsertUserTier` helper (with explicit `allowDowngrade`) instead of inlining `from('user_tiers').upsert({tier, ...})` so the no-downgrade invariant other handlers depend on stays consistent. The user's draft would silently bypass it.
- Keeps initial credit grants owned by `checkout.session.completed` (this handler **never** grants credits — only revokes on cancel/unpaid).
- `past_due` / `incomplete*` get a status-only stamp so the UI can show "needs attention" without losing benefits during Stripe's smart-retry window.
- `canceled`/`unpaid` mirrors the existing `subscription.deleted` block exactly (revoke + downgrade + sync) so duplicate `deleted` and `updated→canceled` events converge to the same state.

### Verification
- `grep -c "subscription.created\|subscription.updated\|subscription_status" supabase/functions/stripe-webhook/index.ts` ≥ 3 (will hit ~6: case labels + 3 column writes).
- `\d public.user_tiers` shows the three new columns.
- Manual: replay a `customer.subscription.updated` event with `status='past_due'` → row gets `subscription_status='past_due'`, club credits untouched. Replay with `status='canceled'` → club credits zeroed, tier='free', balance synced.

### Out of scope
- Mid-cycle plan upgrade/downgrade credit reconciliation (e.g. voyager→explorer top-up of base credits). Initial grants still flow through `checkout.session.completed`; tier in `user_tiers` will reflect the new metadata via `upsertUserTier`'s upgrade path, but credit deltas for plan-changes are deferred.
- Backfilling `subscription_status` for existing tier rows (no Stripe replay endpoint here; future events will populate naturally).