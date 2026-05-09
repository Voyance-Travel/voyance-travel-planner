-- Atomic conditional decrement for group budget pool.
CREATE OR REPLACE FUNCTION public.spend_from_group_budget(
  p_budget_id uuid,
  p_cost      int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new int;
BEGIN
  IF p_cost IS NULL OR p_cost <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_cost');
  END IF;

  UPDATE public.group_budgets
     SET remaining_credits = remaining_credits - p_cost,
         updated_at = now()
   WHERE id = p_budget_id
     AND remaining_credits >= p_cost
  RETURNING remaining_credits INTO v_new;

  IF v_new IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'insufficient');
  END IF;

  RETURN jsonb_build_object('success', true, 'remaining_credits', v_new);
END;
$$;

REVOKE ALL ON FUNCTION public.spend_from_group_budget(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spend_from_group_budget(uuid, int) TO service_role;