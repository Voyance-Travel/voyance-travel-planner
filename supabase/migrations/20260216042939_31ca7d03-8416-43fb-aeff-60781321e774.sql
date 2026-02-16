-- Add JSONB column for individual per-traveler budgets
-- Format: { "member_id_or_name": amount_cents, ... }
ALTER TABLE public.trips
ADD COLUMN IF NOT EXISTS budget_individual_cents jsonb DEFAULT NULL;