-- Table to track which credit bonuses a user has claimed
CREATE TABLE public.user_credit_bonuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bonus_type TEXT NOT NULL,
  credits_granted INTEGER NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, bonus_type)
);

-- Enable RLS
ALTER TABLE public.user_credit_bonuses ENABLE ROW LEVEL SECURITY;

-- Users can view their own bonuses
CREATE POLICY "Users can view their own bonuses"
ON public.user_credit_bonuses
FOR SELECT
USING (auth.uid() = user_id);

-- Only system can insert (via service role in edge functions)
CREATE POLICY "Service role can manage bonuses"
ON public.user_credit_bonuses
FOR ALL
USING (true)
WITH CHECK (true);

-- Add index for faster lookups
CREATE INDEX idx_user_credit_bonuses_user_id ON public.user_credit_bonuses(user_id);
CREATE INDEX idx_user_credit_bonuses_type ON public.user_credit_bonuses(bonus_type);

-- Add launch_bonus_ends_at to track promotional period
-- This will be a system config we check
COMMENT ON TABLE public.user_credit_bonuses IS 'Tracks credit bonuses claimed by users. bonus_type values: welcome, launch, quiz_completion, preferences_completion, first_share, second_itinerary';