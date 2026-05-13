-- Backfill orphan pending_credit_charges rows whose underlying spend
-- already committed in credit_ledger. Without this, the next page load
-- triggers useStalePendingChargeRefund and silently grants the user a
-- duplicate refund (root cause of the "+180 credits on hard refresh" bug).
UPDATE public.pending_credit_charges p
SET status = 'completed',
    resolved_at = now(),
    resolution_note = 'Backfill: spend ledger already committed'
WHERE p.status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.credit_ledger l
    WHERE l.user_id = p.user_id
      AND l.transaction_type = 'spend'
      AND l.metadata->>'pendingChargeId' = p.id::text
      AND l.metadata->>'status' = 'committed'
  );