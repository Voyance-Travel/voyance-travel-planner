-- Add Stripe Connect columns to user_preferences for agent payouts
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_connect_status TEXT DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_complete BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_payout_schedule TEXT DEFAULT 'manual';

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_stripe_connect 
ON public.user_preferences(stripe_connect_account_id) 
WHERE stripe_connect_account_id IS NOT NULL;

COMMENT ON COLUMN public.user_preferences.stripe_connect_account_id IS 'Stripe Connect Express account ID for agent payouts';
COMMENT ON COLUMN public.user_preferences.stripe_connect_status IS 'Onboarding status: not_started, pending, complete, restricted';
COMMENT ON COLUMN public.user_preferences.stripe_connect_onboarding_complete IS 'Whether agent has completed Stripe identity verification';
COMMENT ON COLUMN public.user_preferences.stripe_payout_schedule IS 'Payout frequency: manual, daily, weekly, monthly';