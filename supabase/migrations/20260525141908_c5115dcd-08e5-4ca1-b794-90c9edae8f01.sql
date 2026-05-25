
DO $$
DECLARE
  v_trip_id uuid := 'd18b2e8a-310e-42c8-a7aa-aac61076a234';
  v_acts jsonb;
  v_new_acts jsonb := '[]'::jsonb;
  v_act jsonb;
  v_title text;
  v_data jsonb;
  v_days jsonb;
  v_day0 jsonb;
BEGIN
  -- 1. Fix itinerary_days.activities for Day 1
  SELECT activities INTO v_acts FROM itinerary_days
    WHERE trip_id = v_trip_id AND day_number = 1;

  IF v_acts IS NOT NULL THEN
    FOR v_act IN SELECT * FROM jsonb_array_elements(v_acts)
    LOOP
      v_title := coalesce(v_act->>'title','');
      IF v_title = 'Arrival Flight' THEN
        v_act := v_act
          || jsonb_build_object(
            'startTime','02:30',
            'endTime','04:30',
            'isLocked', true,
            'locked', true,
            'lock_state','locked',
            'anchorSource','arrival-flight',
            'source','repair-arrival-flight'
          );
      ELSIF v_title ILIKE 'Luggage Drop%' THEN
        v_act := v_act
          || jsonb_build_object('startTime','05:30','endTime','05:50');
      END IF;
      v_new_acts := v_new_acts || v_act;
    END LOOP;

    -- Re-sort by startTime
    SELECT jsonb_agg(a ORDER BY (a->>'startTime')) INTO v_new_acts
      FROM jsonb_array_elements(v_new_acts) a;

    UPDATE itinerary_days SET activities = v_new_acts
      WHERE trip_id = v_trip_id AND day_number = 1;
  END IF;

  -- 2. Mirror into trips.itinerary_data.days[0].activities
  SELECT itinerary_data INTO v_data FROM trips WHERE id = v_trip_id;
  IF v_data IS NOT NULL AND jsonb_typeof(v_data->'days') = 'array' THEN
    v_days := v_data->'days';
    v_day0 := v_days->0;
    IF v_day0 IS NOT NULL THEN
      v_day0 := jsonb_set(v_day0, '{activities}', v_new_acts, true);
      v_days := jsonb_set(v_days, '{0}', v_day0, false);
      v_data := jsonb_set(v_data, '{days}', v_days, false);
      UPDATE trips SET itinerary_data = v_data WHERE id = v_trip_id;
    END IF;
  END IF;

  -- 3. Stamp repair sentinel
  UPDATE trips SET metadata = jsonb_set(
    coalesce(metadata,'{}'::jsonb),
    '{repairs,arrival_flight_anchored_at}',
    to_jsonb(now()),
    true
  ) WHERE id = v_trip_id;
END$$;
