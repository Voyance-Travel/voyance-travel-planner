-- pg_cron sweeper: auto-refund stale pending credit charges
-- Closes the tab-close-mid-failure window where useStalePendingChargeRefund
-- never gets to fire because the user closed the tab before refund.

CREATE OR REPLACE FUNCTION public.sweep_stale_pending_charges()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_swept int := 0;
  v_skipped int := 0;
  v_func_url text;
  v_service_key text;
BEGIN
  v_func_url := current_setting('supabase.functions_url', true);
  v_service_key := current_setting('supabase.service_role_key', true);

  IF v_func_url IS NULL OR v_service_key IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_settings');
  END IF;

  FOR v_row IN
    SELECT id, user_id, trip_id, action, credits_amount, refund_attempts
    FROM public.pending_credit_charges
    WHERE status = 'pending'
      AND created_at < now() - interval '5 minutes'
      AND refund_attempts < 3
    ORDER BY created_at ASC
    LIMIT 50
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Optimistic increment (race-safe vs client hook firing simultaneously)
    UPDATE public.pending_credit_charges
       SET refund_attempts = refund_attempts + 1
     WHERE id = v_row.id
       AND refund_attempts = v_row.refund_attempts;

    IF NOT FOUND THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    PERFORM net.http_post(
      url := v_func_url || '/spend-credits',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body := jsonb_build_object(
        'action', 'REFUND',
        'tripId', v_row.trip_id,
        'userId', v_row.user_id,
        'creditsAmount', v_row.credits_amount,
        'metadata', jsonb_build_object(
          'reason', 'cron_stale_pending_sweeper',
          'originalAction', v_row.action,
          'pendingChargeId', v_row.id,
          'source', 'cron'
        )
      )
    );

    v_swept := v_swept + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'swept', v_swept,
    'skipped', v_skipped,
    'ran_at', now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sweep_stale_pending_charges() FROM PUBLIC, anon, authenticated;

-- Idempotent unschedule (safe re-run)
DO $$
BEGIN
  PERFORM cron.unschedule('sweep-stale-pending-charges');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'sweep-stale-pending-charges',
  '*/5 * * * *',
  $$SELECT public.sweep_stale_pending_charges();$$
);

COMMENT ON FUNCTION public.sweep_stale_pending_charges() IS
  'pg_cron sweeper: refunds pending_credit_charges rows >5min old via spend-credits REFUND. Uses optimistic refund_attempts increment to race-safely cooperate with the client useStalePendingChargeRefund hook (which has a 2min threshold, so client always gets first shot). Max 3 attempts per charge; spend-credits handles idempotency via pendingChargeId.';