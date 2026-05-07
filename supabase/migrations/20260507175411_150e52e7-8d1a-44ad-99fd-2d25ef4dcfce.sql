CREATE OR REPLACE FUNCTION public.expire_stale_trip_payments(
  p_trip_id uuid DEFAULT NULL,
  p_max_age_minutes int DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_expired_count int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authenticated', 'expired_count', 0);
  END IF;

  IF p_trip_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = p_trip_id AND user_id = v_user_id) THEN
      RETURN jsonb_build_object('success', false, 'reason', 'not_owner', 'expired_count', 0);
    END IF;

    UPDATE public.trip_payments
    SET status = 'failed',
        updated_at = now()
    WHERE trip_id = p_trip_id
      AND status IN ('pending', 'processing')
      AND archived_at IS NULL
      AND created_at < now() - (p_max_age_minutes || ' minutes')::interval
      AND stripe_checkout_session_id IS NOT NULL
      AND paid_at IS NULL;
  ELSE
    UPDATE public.trip_payments
    SET status = 'failed',
        updated_at = now()
    WHERE user_id = v_user_id
      AND status IN ('pending', 'processing')
      AND archived_at IS NULL
      AND created_at < now() - (p_max_age_minutes || ' minutes')::interval
      AND stripe_checkout_session_id IS NOT NULL
      AND paid_at IS NULL;
  END IF;

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'expired_count', v_expired_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_trip_payments(uuid, int) TO authenticated;

UPDATE public.trip_payments
SET status = 'failed',
    updated_at = now()
WHERE status IN ('pending', 'processing')
  AND archived_at IS NULL
  AND paid_at IS NULL
  AND stripe_payment_intent_id IS NULL
  AND created_at < now() - interval '1 hour';