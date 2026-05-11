-- Group A: Revoke service-only SECURITY DEFINER functions from PUBLIC/authenticated/anon
REVOKE EXECUTE ON FUNCTION public.add_to_group_budget(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_to_group_budget(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.add_to_group_budget(uuid, integer) FROM anon;
GRANT  EXECUTE ON FUNCTION public.add_to_group_budget(uuid, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.deduct_credits_fifo(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.deduct_credits_fifo(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_credits_fifo(uuid, integer) FROM anon;
GRANT  EXECUTE ON FUNCTION public.deduct_credits_fifo(uuid, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.spend_from_group_budget(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.spend_from_group_budget(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.spend_from_group_budget(uuid, integer) FROM anon;
GRANT  EXECUTE ON FUNCTION public.spend_from_group_budget(uuid, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.consume_free_edit(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_free_edit(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_free_edit(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.consume_free_edit(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_intake_account(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_intake_account(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_intake_account(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_intake_account(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_journey_trips(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_journey_trips(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_journey_trips(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_journey_trips(uuid) TO service_role;

-- Group E: Add internal auth check to claim_first_trip_benefit
CREATE OR REPLACE FUNCTION public.claim_first_trip_benefit(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_was_unused boolean;
BEGIN
  -- Authorization: only the user themselves may claim their first-trip benefit
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized: caller must be the target user' USING ERRCODE = '42501';
  END IF;

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
$function$;