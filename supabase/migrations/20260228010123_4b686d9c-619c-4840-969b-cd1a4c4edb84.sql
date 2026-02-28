
-- Phase 3: Fix pending_credit_charges status check to include 'failed'
ALTER TABLE public.pending_credit_charges DROP CONSTRAINT IF EXISTS pending_credit_charges_status_check;
ALTER TABLE public.pending_credit_charges ADD CONSTRAINT pending_credit_charges_status_check 
  CHECK (status IN ('pending', 'completed', 'refunded', 'failed'));

-- Backfill: mark old stuck pending rows as failed if older than 10 minutes
UPDATE public.pending_credit_charges 
SET status = 'failed', 
    resolved_at = now(), 
    resolution_note = 'Auto-resolved: stale pending charge backfill'
WHERE status = 'pending' 
  AND created_at < now() - interval '10 minutes';
