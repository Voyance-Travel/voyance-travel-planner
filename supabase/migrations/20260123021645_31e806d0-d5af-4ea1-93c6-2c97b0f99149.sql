-- Add assigned_member_id to trip_payments to track who is responsible for each item
ALTER TABLE public.trip_payments 
ADD COLUMN assigned_member_id UUID REFERENCES public.trip_members(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_trip_payments_assigned_member ON public.trip_payments(assigned_member_id) WHERE assigned_member_id IS NOT NULL;

-- Comment for clarity
COMMENT ON COLUMN public.trip_payments.assigned_member_id IS 'The trip member responsible for paying this item';