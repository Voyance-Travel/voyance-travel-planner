ALTER TABLE public.user_tiers
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status   text,
  ADD COLUMN IF NOT EXISTS current_period_end    timestamptz;

CREATE INDEX IF NOT EXISTS idx_user_tiers_stripe_sub
  ON public.user_tiers (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;