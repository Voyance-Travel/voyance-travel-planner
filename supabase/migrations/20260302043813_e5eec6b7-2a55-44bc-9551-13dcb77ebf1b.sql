
CREATE OR REPLACE FUNCTION public.claim_first_trip_benefit(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_was_unused boolean;
BEGIN
  -- Atomic check-and-set: only succeeds if first_trip_used is currently false
  UPDATE public.profiles
  SET first_trip_used = true
  WHERE id = p_user_id AND first_trip_used = false
  RETURNING true INTO v_was_unused;

  IF v_was_unused IS TRUE THEN
    RETURN jsonb_build_object('claimed', true);
  ELSE
    RETURN jsonb_build_object('claimed', false, 'reason', 'already_used');
  END IF;
END;
$$;
