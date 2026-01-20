-- P0 Fix 1: Add unique constraints for webhook idempotency
-- Prevents duplicate ledger entries from Stripe webhook retries

-- Unique constraint on payment_intent + entry_type
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_stripe_payment_intent 
ON finance_ledger_entries(stripe_payment_intent_id, entry_type) 
WHERE stripe_payment_intent_id IS NOT NULL;

-- Unique constraint on refund_id + entry_type
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_stripe_refund 
ON finance_ledger_entries(stripe_refund_id, entry_type) 
WHERE stripe_refund_id IS NOT NULL;

-- Unique constraint on transfer_id + entry_type
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_stripe_transfer 
ON finance_ledger_entries(stripe_transfer_id, entry_type) 
WHERE stripe_transfer_id IS NOT NULL;

-- Unique constraint on dispute_id + entry_type  
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_stripe_dispute
ON finance_ledger_entries(stripe_dispute_id, entry_type) 
WHERE stripe_dispute_id IS NOT NULL;

-- P0 Fix 3: Add is_client_visible column to trip_activities
-- Allows agents to mark activities as internal-only
ALTER TABLE trip_activities 
ADD COLUMN IF NOT EXISTS is_client_visible BOOLEAN DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN trip_activities.is_client_visible IS 'When false, activity is hidden from client/shared views';