
CREATE OR REPLACE FUNCTION public.deduct_credits_fifo(p_user_id uuid, p_cost integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row record;
  v_remaining integer := p_cost;
  v_take integer;
  v_total_available integer;
  v_deductions jsonb := '[]'::jsonb;
BEGIN
  IF p_cost <= 0 THEN
    RETURN jsonb_build_object('success', true, 'deducted', 0, 'purchases', '[]'::jsonb);
  END IF;

  -- Lock eligible rows first (FOR UPDATE cannot be combined with aggregates)
  -- Then compute the sum from the locked rows via a subquery
  SELECT COALESCE(SUM(remaining), 0)::integer INTO v_total_available
  FROM (
    SELECT remaining
    FROM credit_purchases
    WHERE user_id = p_user_id
      AND remaining > 0
      AND (expires_at IS NULL OR expires_at > now())
    FOR UPDATE
  ) locked;

  IF v_total_available < p_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS: required=%, available=%', p_cost, v_total_available;
  END IF;

  -- FIFO deduction loop (rows already locked above)
  FOR v_row IN
    SELECT id, remaining
    FROM credit_purchases
    WHERE user_id = p_user_id
      AND remaining > 0
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY expires_at ASC NULLS LAST
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_take := LEAST(v_row.remaining, v_remaining);

    UPDATE credit_purchases
    SET remaining = remaining - v_take,
        updated_at = now()
    WHERE id = v_row.id;

    v_deductions := v_deductions || jsonb_build_object('id', v_row.id, 'deducted', v_take);
    v_remaining := v_remaining - v_take;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'deducted', p_cost,
    'purchases', v_deductions
  );
END;
$function$;
