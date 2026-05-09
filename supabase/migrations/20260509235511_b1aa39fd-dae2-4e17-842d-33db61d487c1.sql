CREATE OR REPLACE FUNCTION public.rescue_orphan_cost_row(
  p_trip_id uuid,
  p_day_number int,
  p_category text,
  p_new_activity_id uuid,
  p_live_activity_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_id uuid;
BEGIN
  SELECT id INTO v_target_id
  FROM public.activity_costs
  WHERE trip_id = p_trip_id
    AND day_number = p_day_number
    AND lower(category) = lower(p_category)
    AND COALESCE(source, '') <> 'logistics-sync'
    AND activity_id <> p_new_activity_id
    AND NOT (activity_id = ANY(p_live_activity_ids))
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_target_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_candidate');
  END IF;

  UPDATE public.activity_costs
     SET activity_id = p_new_activity_id,
         updated_at = now()
   WHERE id = v_target_id;

  RETURN jsonb_build_object('success', true, 'rescued_row_id', v_target_id);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success', false, 'reason', 'already_rescued');
END $$;

REVOKE ALL ON FUNCTION public.rescue_orphan_cost_row(uuid, int, text, uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rescue_orphan_cost_row(uuid, int, text, uuid, uuid[]) TO authenticated, service_role;