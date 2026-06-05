-- FIX: public-link trip sharing was broken in production — the Share dialog's
-- "Public link" toggle called rpc('toggle_consumer_trip_share') which returned
-- 404 → toast "Could not update sharing".
--
-- Two distinct problems were behind the 404:
--   1. The function defined in earlier migrations (20260406/20260509) was never
--      applied to prod. This migration re-asserts the canonical definition.
--   2. ROOT CAUSE of the runtime 404 (even once present): the body calls
--      gen_random_bytes(), which lives in the `extensions` schema, but the
--      function had `SET search_path = public` only. At execution time Postgres
--      could not resolve gen_random_bytes → "function does not exist", which
--      PostgREST surfaces as a 404. Fix: include `extensions` in search_path so
--      gen_random_bytes resolves at runtime.
-- (CREATE OR REPLACE is idempotent — safe if the function already exists.)

CREATE OR REPLACE FUNCTION public.toggle_consumer_trip_share(p_trip_id uuid, p_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'  -- `extensions` required: gen_random_bytes() lives there
AS $$
DECLARE
  v_user_id uuid;
  v_trip record;
  v_token text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id;
  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'trip_not_found');
  END IF;

  IF v_trip.user_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_owner');
  END IF;

  -- Readiness gate: refuse to enable sharing until the itinerary exists.
  IF p_enabled IS TRUE THEN
    IF v_trip.itinerary_data IS NULL
       OR v_trip.itinerary_data->'days' IS NULL
       OR jsonb_array_length(COALESCE(v_trip.itinerary_data->'days', '[]'::jsonb)) = 0 THEN
      RETURN jsonb_build_object('success', false, 'reason', 'itinerary_not_ready');
    END IF;
  END IF;

  v_token := v_trip.share_token;
  IF p_enabled AND v_token IS NULL THEN
    v_token := encode(gen_random_bytes(12), 'hex');
  END IF;

  UPDATE public.trips
  SET share_enabled = p_enabled, share_token = v_token
  WHERE id = p_trip_id;

  RETURN jsonb_build_object(
    'success', true,
    'share_enabled', p_enabled,
    'share_token', v_token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_consumer_trip_share(uuid, boolean) TO authenticated;

-- Tell PostgREST to reload its schema cache so the RPC resolves immediately.
NOTIFY pgrst, 'reload schema';
