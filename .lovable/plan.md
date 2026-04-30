# Two-Path Group Credit Top-Up

You're right — and the system half-supports this today. The "transfer from my balance" path works, but the "buy fresh credits straight into the group" path doesn't exist as one flow. Today the owner has to leave the trip, buy credits on the Pricing page, come back, then transfer. That's the friction you're feeling.

## What changes

The `GroupTopupModal` becomes a two-tab modal:

```text
┌─ Top Up Group Pool ────────────────────┐
│                                        │
│  [ From my balance ] [ Buy new pack ]  │  ← tabs
│                                        │
│  Your balance: 240 credits             │
│  ( 50 ) ( 100 ) ( 200 )                │
│  [ Add 100 credits to group ]          │
└────────────────────────────────────────┘
```

### Tab 1 — From my balance (existing behavior, unchanged)
Preset 50 / 100 / 200, calls `topup-group-budget`, deducts from owner's personal balance, adds to pool. Already works.

### Tab 2 — Buy new pack (new)
Shows the same credit packs from `CREDIT_PACKS` (Pricing page catalog). Owner picks a pack → Stripe Checkout opens → on success, the purchased credits land **directly in the group pool**, not the owner's personal balance.

## How it works (technical)

1. **Frontend** — Add `<Tabs>` to `GroupTopupModal.tsx`. Tab 2 renders pack cards (reuse styles from `CreditsAndBilling.tsx`) and calls `create-checkout` with new metadata: `{ destination: "group_pool", trip_id }`.

2. **`create-checkout` edge function** — Accept optional `destination` and `tripId` in the request body. Pass them through to Stripe session metadata so the webhook knows where the credits go. Validate the caller is the trip owner before allowing `destination=group_pool`.

3. **`stripe-webhook` edge function** — On `checkout.session.completed`, branch on `metadata.destination`:
   - `"group_pool"` → call the same internal logic as `topup-group-budget` (insert into `group_budgets` / `group_budget_transactions`) instead of crediting the user's personal balance. Mark the ledger row `source: 'stripe_purchase'` so it shows up correctly in recent activity.
   - default → existing behavior (credit personal balance).

4. **Success return path** — `returnPath` set to the trip URL with `?group_topup=success` so we can fire a toast and refresh `['group-budget', tripId]` queries when the user returns.

5. **Edge case** — If the Stripe payment succeeds but the trip was deleted between checkout and webhook, fall back to crediting the owner's personal balance and log it. No money lost.

## Files touched

- `src/components/modals/GroupTopupModal.tsx` — add tabs, pack picker UI
- `supabase/functions/create-checkout/index.ts` — accept + forward `destination` and `tripId` metadata, owner check
- `supabase/functions/stripe-webhook/index.ts` — branch credit destination on metadata
- `src/components/itinerary/GroupBudgetDisplay.tsx` — minor copy: "Top up pool" stays, but the empty-state CTA already says "Purchase group credits" which now actually does that

## Verification

- As owner with sufficient balance: Tab 1 → pool increases, personal balance decreases. (regression check)
- As owner with zero balance: Tab 2 → Stripe Checkout → on return, pool shows new credits, personal balance unchanged.
- As non-owner collaborator: modal not reachable (existing guard).
- Webhook idempotency: replay the same `checkout.session.completed` event, pool credited only once.
