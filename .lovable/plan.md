## RS.1 — Subscription lifecycle handlers (stripe-webhook)

**File:** `supabase/functions/stripe-webhook/index.ts` (replace stub at L976–L980)

Replace the no-op `customer.subscription.*` block with real handlers, plus a new `invoice.payment_succeeded` case for renewals. Reuses existing `CLUB_PRODUCT_MAP`, `syncBalanceCache`, `fulfill_credit_purchase` RPC, and `user_tiers` patterns already in the file.

### Resolution helpers (inline in the new block)

Tier/user resolution order on `invoice.payment_succeeded` and on `customer.subscription.deleted`:

1. `sub.metadata.user_id` || `sub.metadata.userId`
2. Stripe customer email → `auth.users` lookup via `supabaseAdmin.auth.admin.listUsers()` filter (or `profiles` table by email)

Tier resolution order:

1. `sub.metadata.tier` || `sub.metadata.club_tier` (only if it's a known tier)
2. `sub.items.data[0].price.product` (a `prod_…` id) → `CLUB_PRODUCT_MAP[productId].tier`

If both fail → `console.warn` with subscription id and `break` (Stripe will not retry; this is a config issue, not a transient one).

### Behavior

**`invoice.payment_succeeded`** (subscription renewals only):
- Skip when `!invoice.subscription` (one-time invoices, e.g. flex top-ups, are already handled via `checkout.session.completed`).
- Retrieve subscription, resolve `userId` + `tier`/`productId` via the order above.
- Look up `clubInfo = CLUB_PRODUCT_MAP[productId]` — single source of truth (voyager 500/100, explorer 1200/400, adventurer 2500/700). No duplicated TIER_CONFIG.
- Call existing `fulfill_credit_purchase` RPC with:
  - `p_credits: clubInfo.baseCredits`
  - `p_bonus_credits: clubInfo.bonusCredits`
  - `p_credit_type: 'club_base'`
  - `p_stripe_session_id: \`subscription_renewal_${invoice.id}\`` (idempotent — invoice id is unique per renewal; the RPC's unique index on `(stripe_session_id, transaction_type)` handles replays).
  - `p_amount_cents: invoice.amount_paid || 0`
  - `p_club_tier: clubInfo.tier`, `p_product_id: productId`, `p_price_id: invoice.lines.data[0]?.price?.id ?? null`
- On RPC error → `logError` and `throw` (so we return 500 and Stripe retries — same pattern as `checkout.session.completed`).
- On success → `syncBalanceCache(supabaseAdmin, userId)`.
- Re-upsert `user_tiers` to the renewed tier (only upgrade, never downgrade — same `TIER_HIERARCHY` block already used at L393–L416; refactor into a small `upsertUserTier(userId, tier)` helper at file top so both flows share it).

**`customer.subscription.deleted`**:
- Resolve `userId` (metadata → email lookup). If unresolvable, warn + break.
- Zero out remaining club credits: `update credit_purchases set remaining = 0 where user_id = $userId and credit_type in ('club_base','club_bonus')`.
- Insert audit row in `credit_ledger`:
  - `transaction_type: 'subscription_cancel'`, `credits_delta: 0`, `is_free_credit: false`, `action_type: 'subscription_deleted'`
  - `metadata: { stripe_subscription_id, cancelled_at: sub.canceled_at ? ISO : null }`
- Force-downgrade `user_tiers` to `'free'` via direct upsert (this is the one path that bypasses the upgrade-only guard — cancellation is the documented downgrade trigger).
- `syncBalanceCache(supabaseAdmin, userId)`.

**`customer.subscription.created`** & **`customer.subscription.updated`**:
- No-op — initial grant is handled by the original `checkout.session.completed` (subscription mode passes the same metadata + product into that flow today). Just `log('Subscription event (no-op for v1)', { subId, type, status })` for observability.

### New small helper at top of file (near `syncBalanceCache`)

```ts
async function upsertUserTier(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  newTier: string,
  opts: { allowDowngrade?: boolean } = {}
) { /* mirrors L393-L416 logic, with allowDowngrade=true for cancellation */ }
```

Refactor the existing inline block at L393–L416 to call `upsertUserTier(..., { allowDowngrade: false })` so the downgrade path on cancellation reuses the same code.

### Email→userId fallback helper

```ts
async function resolveUserIdFromCustomer(
  supabaseAdmin, stripe, customerId: string
): Promise<string | null> {
  const customer = await stripe.customers.retrieve(customerId);
  if (!customer || customer.deleted || !customer.email) return null;
  const { data } = await supabaseAdmin.auth.admin.listUsers();
  return data?.users?.find(u => u.email?.toLowerCase() === customer.email.toLowerCase())?.id ?? null;
}
```

### Verify

```
grep -c "subscription.deleted\|invoice.payment_succeeded\|subscription_renewal_" supabase/functions/stripe-webhook/index.ts
```
Expect ≥ 3.

### Caveat (preserved from spec)

Subscription-mode checkout flows must stamp `metadata: { user_id, tier }` on `subscription_data` to make resolution deterministic. The fallback path (customer.email → auth.users + price.product → CLUB_PRODUCT_MAP) handles legacy subs without metadata, but emit a `console.warn` whenever the fallback fires so we can audit and backfill. **Out of scope:** updating any subscription-creation flow; that's a separate task.

### Out of scope
- No DB schema changes (uses existing `credit_purchases`, `credit_ledger`, `user_tiers`).
- No frontend changes.
- No update to `CLUB_PRODUCT_MAP` (already correct).
- Plan/upgrade/downgrade mid-cycle handling (`subscription.updated`) — logged only; v2 work.
