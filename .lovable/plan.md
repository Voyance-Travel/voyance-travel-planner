## Lock down `validate-iap-receipt` — fail-closed Apple verification + verified-txn idempotency

### What's wrong today (`supabase/functions/validate-iap-receipt/index.ts`)

1. **Dev-mode bypass (line 146/180).** If the request omits `receiptData` (or `APPLE_SHARED_SECRET` is unset), Apple verification is skipped entirely and credits are still granted.
2. **Idempotency keyed on client-supplied `transactionId`** (line 130) — the attacker controls that value, so they can vary it per request to bypass the dedupe check. The verified `transaction_id` from Apple's response is the only trustworthy value.
3. Apple's `latest_receipt_info` is never read, so we can't even prove the client's `transactionId` matches the receipt.

The `fulfill_credit_purchase` RPC's `stripe_session_id` unique index gives DB-level dedupe as a backstop, but the function still happily *records* a fake `iap_transactions` row and would have granted credits if that backstop didn't exist for a different `sessionId`.

### Existing infra (no need to rebuild)

- `public.iap_transactions` already exists with `UNIQUE(transaction_id)` and RLS enabled (1 policy). The user's spec calls for a new `iap_receipts` table — I'll **reuse `iap_transactions`** and add the missing columns rather than create a duplicate (less drift, preserves existing rows).
- `fulfill_credit_purchase` RPC handles the credit grant + ledger idempotency via `stripe_session_id` unique index. Keep using it.

### Changes

**1) Migration — extend `iap_transactions`**

```sql
ALTER TABLE public.iap_transactions
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS credits_granted integer,
  ADD COLUMN IF NOT EXISTS raw_receipt jsonb;

-- Confirm owner-only read (RLS already on). Add policy if not present.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='iap_transactions'
      AND policyname='iap_transactions_owner_read'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "iap_transactions_owner_read"
        ON public.iap_transactions
        FOR SELECT TO authenticated
        USING (user_id = auth.uid())
    $p$;
  END IF;
END $$;

REVOKE INSERT, UPDATE, DELETE ON public.iap_transactions FROM authenticated, anon;
```

No new `iap_receipts` table — the spec's required columns all live on `iap_transactions` after this migration.

**2) Edge function rewrite — `supabase/functions/validate-iap-receipt/index.ts`**

Fail-closed flow:

```text
1. Require Authorization header → 401 if missing.
2. Parse JSON body: { receiptData, productId } — transactionId from client is ignored for trust; only used for logging.
3. If !receiptData → 400 IAP_NO_RECEIPT.
4. If !APPLE_SHARED_SECRET in env → 500 IAP_NOT_CONFIGURED (fail closed; never grant on misconfig).
5. Look up productId in PRODUCT_CONFIG → 400 if unknown.
6. POST to Apple verifyReceipt (prod URL); if status===21007, retry against sandbox URL.
   - On any non-zero, non-21007 status → appleStatusError(status) (400).
   - On thrown network error after retries → 502 IAP_VERIFY_FAILED (fail closed).
7. Extract verified txn:
     const txn = verifiedData.latest_receipt_info?.[0]
              ?? verifiedData.receipt?.in_app?.[0];
   - If !txn?.transaction_id || !txn?.product_id → 400 IAP_NO_TXN.
   - If txn.product_id !== productId → 400 IAP_PRODUCT_MISMATCH (prevents
     buying flex100 and claiming adventurer tier).
8. Idempotency by verified transaction_id:
     SELECT id, credits_granted FROM iap_transactions
       WHERE transaction_id = txn.transaction_id
   - If row exists → return { success:true, duplicate:true, credits: row.credits_granted }.
9. Insert iap_transactions row with verified_at + raw_receipt + credits_granted
   (= config.credits + config.bonusCredits). Insert before RPC so a concurrent
   duplicate fails fast on the UNIQUE constraint.
10. Call fulfill_credit_purchase with p_stripe_session_id = `apple_iap_${txn.transaction_id}`.
    - If RPC returns skipped:true (DB-level dedupe), return duplicate:true.
11. Return { success:true, credits: totalCredits }.
```

Removed: the entire `if (receiptData && sharedSecret) { … } else { proceeding with trust }` branch.

Notes:
- Server-side abuse mitigation: log + reject if `txn.product_id` is not in PRODUCT_CONFIG (already covered by step 5 + step 7 cross-check).
- Sandbox handling: prod URL first, fall back to sandbox only on 21007 (matches Apple's recommendation; current code already does this for one direction).

### Verification

1. POST without `receiptData` → 400 `IAP_NO_RECEIPT`, no DB rows, no credits.
2. POST with garbage `receiptData` → Apple returns status 21002/21003/21004 → 400 with `APPLE_STATUS_…`, no DB rows.
3. POST a valid sandbox receipt with `APPLE_IAP_SANDBOX=true` env or via 21007 fallback → row inserted in `iap_transactions` with `verified_at`, `raw_receipt`, `credits_granted`; credits granted once.
4. Replay the same valid receipt → `{ success:true, duplicate:true, credits: <same> }`, no ledger growth.
5. Replay with a different fabricated client `transactionId` but same receipt → still dedupes (idempotency now keyed on Apple's `transaction_id`, not client input).
6. POST with valid receipt for `flex100` but `productId: 'com.voyancetravel.club.adventurer'` → 400 `IAP_PRODUCT_MISMATCH`.

### Files

- New migration: `supabase/migrations/<ts>_lock_down_iap_receipts.sql` (ALTER + policy + REVOKE)
- Edit: `supabase/functions/validate-iap-receipt/index.ts` (rewrite verification block + idempotency lookup)

No frontend changes — the mobile client already sends `receiptData`; the only behavioral change is the server now rejecting requests that omit it.
