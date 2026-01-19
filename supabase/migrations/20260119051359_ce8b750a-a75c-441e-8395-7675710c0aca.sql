-- Add unique constraint for upsert operations on trip_payments
-- This allows us to update existing payment records for the same item
ALTER TABLE public.trip_payments 
ADD CONSTRAINT trip_payments_unique_item 
UNIQUE (trip_id, item_type, item_id);