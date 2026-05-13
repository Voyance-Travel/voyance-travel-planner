## Bug

Hard refresh on a successfully generated trip credited the user **+180** with no new generation. Repeats every reload (also +180, +180, +180 in the ledger over the last few hours).

## Root cause

`spend-credits` creates a `pending_credit_charges` row with `status='pending'`, deducts FIFO, finalizes the ledger, returns success — **but never flips the pending row to `completed`**. Only failure paths update the row (`failed`/`refunded`).

On the next trip load, `useStalePendingChargeRefund` (TripDetail mount) finds the still-`pending` row older than 2 min, calls `spend-credits` with `action: 'REFUND'`, and silently restores the credits. Confirmed in DB: 4 successive `spend −180 / refund +180` pairs for trip `fea55309…` and siblings, all with `metadata.reason = "stale_pending_charge_auto_refund"` while `metadata.status = "committed"` on the original spend.

The proof-of-charge gate in `generate-itinerary/index.ts` already accepts both `pending` and `completed`, so the generator never had to bother promoting the row — that's the design hole.

## Fix (3 layers)

### 1. Mark the charge `completed` when the spend itself returns success
File: `supabase/functions/spend-credits/index.ts`

After the FIFO deduction succeeds and the claim row is finalized (right around the existing `status: 'committed'` ledger update, ~line 787), add:

```ts
if (pendingChargeId) {
  await supabaseAdmin.from('pending_credit_charges').update({
    status: 'completed',
    resolved_at: new Date().toISOString(),
    resolution_note: 'Spend committed (FIFO + ledger finalized)',
  }).eq('id', pendingChargeId);
}
```

Move it inside the `housekeeping()` block (waitUntil-safe) so it doesn't block the response. This single change closes the leak for every caller.

### 2. Defensive guard in the client sweep
File: `src/hooks/useStalePendingChargeRefund.ts`

Before refunding any stale charge, verify the matching ledger row's `metadata.status`. If a `credit_ledger` row exists for the same `pendingChargeId` with `transaction_type='spend'` and `metadata->>status = 'committed'`, **do not refund** — just mark the pending row `completed` (silent self-heal) and continue. This protects against any future ungated path (regenerate, smart-finish, hotel-search).

Query:
```ts
supabase.from('credit_ledger')
  .select('id, metadata')
  .eq('user_id', user.id)
  .filter('metadata->>pendingChargeId', 'eq', charge.id)
  .eq('transaction_type', 'spend')
  .maybeSingle();
```

If `metadata.status === 'committed'` → flip `pending_credit_charges.status` to `completed`, log `[StalePendingCharge] self-heal: spend already committed`, skip refund.

### 3. One-shot backfill migration
Sweep existing orphan `pending` rows that already have a committed spend ledger entry, so the next refresh doesn't fire one final refund:

```sql
UPDATE pending_credit_charges p
SET status = 'completed',
    resolved_at = now(),
    resolution_note = 'Backfill: spend already committed'
WHERE p.status = 'pending'
  AND EXISTS (
    SELECT 1 FROM credit_ledger l
    WHERE l.user_id = p.user_id
      AND l.transaction_type = 'spend'
      AND l.metadata->>'pendingChargeId' = p.id::text
      AND l.metadata->>'status' = 'committed'
  );
```

## Memory

Add `mem://constraints/credits/pending-charge-must-promote-on-success` to the index so future spend-paths know `pending_credit_charges` rows MUST be promoted to `completed` when the spend ledger commits, and the sweep MUST self-heal rather than blindly refund when a committed spend is found.

## Out of scope

- Lowering the 2-min stale threshold (not the bug).
- Removing the sweep (still useful for true network drops where the spend never returned).
- Reconciling Mallorca/Faro historical refunds (already credited; do not claw back).