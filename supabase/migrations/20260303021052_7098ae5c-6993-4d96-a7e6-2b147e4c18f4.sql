
-- Function to sync expired credit balances
CREATE OR REPLACE FUNCTION public.sync_expired_credit_balances()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.credit_balances cb
  SET 
    free_credits = (
      SELECT COALESCE(SUM(cp.remaining), 0)::int
      FROM public.credit_purchases cp
      WHERE cp.user_id = cb.user_id
        AND cp.remaining > 0
        AND cp.credit_type IN ('free_monthly', 'signup_bonus', 'referral_bonus')
        AND (cp.expires_at IS NULL OR cp.expires_at > now())
    ),
    purchased_credits = (
      SELECT COALESCE(SUM(cp.remaining), 0)::int
      FROM public.credit_purchases cp
      WHERE cp.user_id = cb.user_id
        AND cp.remaining > 0
        AND cp.credit_type NOT IN ('free_monthly', 'signup_bonus', 'referral_bonus')
        AND (cp.expires_at IS NULL OR cp.expires_at > now())
    ),
    updated_at = now()
  WHERE cb.free_credits > 0
    AND cb.free_credits_expires_at IS NOT NULL
    AND cb.free_credits_expires_at < now();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Daily cron at 1 AM UTC
SELECT cron.schedule(
  'sync-expired-credit-balances',
  '0 1 * * *',
  $$SELECT public.sync_expired_credit_balances()$$
);
