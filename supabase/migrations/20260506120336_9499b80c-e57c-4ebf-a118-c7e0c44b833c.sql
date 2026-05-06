ALTER TABLE public.trip_payments
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_reason text;

CREATE INDEX IF NOT EXISTS idx_trip_payments_active
  ON public.trip_payments(trip_id) WHERE archived_at IS NULL;

CREATE OR REPLACE FUNCTION public.archive_orphan_trip_payments(p_trip_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_trip record;
  v_activity_ids text[];
  v_archived_count int;
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

  -- Collect every current activity id from itinerary_data.days[].activities[]
  SELECT COALESCE(array_agg(DISTINCT act->>'id'), ARRAY[]::text[])
  INTO v_activity_ids
  FROM jsonb_array_elements(COALESCE(v_trip.itinerary_data->'days', '[]'::jsonb)) day
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(day->'activities', '[]'::jsonb)) act
  WHERE act->>'id' IS NOT NULL;

  UPDATE public.trip_payments
  SET archived_at = now(),
      archived_reason = 'orphan_reconcile'
  WHERE trip_id = p_trip_id
    AND archived_at IS NULL
    AND item_type NOT IN ('flight', 'hotel')
    AND NOT (item_id = ANY(v_activity_ids));

  GET DIAGNOSTICS v_archived_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'archived_count', v_archived_count);
END;
$$;