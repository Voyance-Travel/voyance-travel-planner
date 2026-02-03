-- Helper function to increment daily usage atomically
CREATE OR REPLACE FUNCTION public.increment_daily_usage(
  p_user_id UUID,
  p_action_type TEXT,
  p_usage_date DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  INSERT INTO public.daily_usage (user_id, action_type, usage_date, count)
  VALUES (p_user_id, p_action_type, p_usage_date, 1)
  ON CONFLICT (user_id, action_type, usage_date)
  DO UPDATE SET 
    count = daily_usage.count + 1,
    updated_at = NOW()
  RETURNING count INTO new_count;
  
  RETURN new_count;
END;
$$;