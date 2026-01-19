-- Add owner_plan_tier to trips table to track what plan the trip was created under
-- This enables the "owner needs to upgrade" logic for collaboration
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS owner_plan_tier text DEFAULT 'free';

-- Add comment explaining the field
COMMENT ON COLUMN public.trips.owner_plan_tier IS 'Plan tier of the owner when trip was created. Determines collaboration capabilities for all users on this trip.';