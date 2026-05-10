-- Unschedule existing cron entry that references the old void-returning function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-rate-limits') THEN
    PERFORM cron.unschedule('cleanup-rate-limits');
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.cleanup_rate_limits();

CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_rl int := 0;
  v_deleted_du int := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'rate_limits'
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'rate_limits_table_missing');
  END IF;

  DELETE FROM public.rate_limits
  WHERE created_at < now() - interval '24 hours';
  GET DIAGNOSTICS v_deleted_rl = ROW_COUNT;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'daily_usage'
  ) THEN
    DELETE FROM public.daily_usage
    WHERE usage_date < CURRENT_DATE - INTERVAL '7 days';
    GET DIAGNOSTICS v_deleted_du = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_rate_limits', v_deleted_rl,
    'deleted_daily_usage', v_deleted_du,
    'ran_at', now()
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END $$;

-- Re-register the daily cleanup cron
SELECT cron.schedule(
  'cleanup-rate-limits',
  '0 0 * * *',
  $cron$SELECT public.cleanup_rate_limits()$cron$
);