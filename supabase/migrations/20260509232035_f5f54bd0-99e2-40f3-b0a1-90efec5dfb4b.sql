-- Ensure pg_cron is available
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Reconciliation function: compare credit_balances cache to source of truth
-- (sum of credit_purchases.remaining) and fix drift. Runs hourly via pg_cron.
CREATE OR REPLACE FUNCTION public.reconcile_credit_balances()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_drift_count int := 0;
  v_total_count int := 0;
  v_user record;
  v_actual_purchased bigint;
  v_actual_free bigint;
  v_cached record;
BEGIN
  FOR v_user IN
    SELECT DISTINCT user_id FROM public.credit_purchases WHERE remaining > 0
  LOOP
    v_total_count := v_total_count + 1;

    SELECT
      COALESCE(SUM(CASE
        WHEN credit_type IN ('flex','club_base','topup','migration','manual_grant')
        THEN remaining ELSE 0 END), 0),
      COALESCE(SUM(CASE
        WHEN credit_type IN ('free_monthly','signup_bonus','referral_bonus','club_bonus','refund')
        THEN remaining ELSE 0 END), 0)
    INTO v_actual_purchased, v_actual_free
    FROM public.credit_purchases
    WHERE user_id = v_user.user_id
      AND remaining > 0
      AND (expires_at IS NULL OR expires_at > now());

    SELECT * INTO v_cached
    FROM public.credit_balances
    WHERE user_id = v_user.user_id;

    IF v_cached.user_id IS NULL OR
       COALESCE(v_cached.purchased_credits, 0) != v_actual_purchased OR
       COALESCE(v_cached.free_credits, 0) != v_actual_free THEN
      v_drift_count := v_drift_count + 1;

      INSERT INTO public.credit_balances (user_id, purchased_credits, free_credits, updated_at)
      VALUES (v_user.user_id, v_actual_purchased, v_actual_free, now())
      ON CONFLICT (user_id) DO UPDATE
        SET purchased_credits = EXCLUDED.purchased_credits,
            free_credits = EXCLUDED.free_credits,
            updated_at = now();
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_users_checked', v_total_count,
    'drift_corrected', v_drift_count,
    'ran_at', now()
  );
END $$;

REVOKE ALL ON FUNCTION public.reconcile_credit_balances() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_credit_balances() TO service_role;

-- Schedule hourly reconciliation (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'reconcile-credit-balances-hourly'
  ) THEN
    PERFORM cron.schedule(
      'reconcile-credit-balances-hourly',
      '0 * * * *',
      $cron$SELECT public.reconcile_credit_balances()$cron$
    );
  END IF;
END $$;