-- Daily usage tracking for authenticated users
CREATE TABLE public.daily_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL, -- 'preview', 'quiz'
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, action_type, usage_date)
);

-- Index for fast lookups
CREATE INDEX idx_daily_usage_lookup ON public.daily_usage (user_id, action_type, usage_date);

-- Enable RLS
ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY;

-- Users can only see their own usage
CREATE POLICY "Users can view own daily usage"
  ON public.daily_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Function to clean up old rate limit records (called by cron)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete rate_limits older than 24 hours
  DELETE FROM public.rate_limits
  WHERE created_at < NOW() - INTERVAL '24 hours';
  
  -- Delete daily_usage older than 7 days (keep some history)
  DELETE FROM public.daily_usage
  WHERE usage_date < CURRENT_DATE - INTERVAL '7 days';
END;
$$;

-- Schedule cleanup to run daily at midnight UTC
SELECT cron.schedule(
  'cleanup-rate-limits',
  '0 0 * * *',
  $$SELECT public.cleanup_rate_limits()$$
);