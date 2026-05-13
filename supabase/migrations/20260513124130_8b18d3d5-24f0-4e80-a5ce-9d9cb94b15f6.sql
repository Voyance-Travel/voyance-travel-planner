DO $$
DECLARE
  trip_row record;
  new_days jsonb;
  day_obj  jsonb;
  day_md   jsonb;
  day_q    jsonb;
  cached_mode text;
  i int;
  changed int := 0;
  affected_trips int := 0;
BEGIN
  FOR trip_row IN
    SELECT id, itinerary_data
    FROM public.trips
    WHERE itinerary_data ? 'days'
      AND jsonb_typeof(itinerary_data->'days') = 'array'
      AND jsonb_array_length(itinerary_data->'days') > 0
  LOOP
    new_days := trip_row.itinerary_data->'days';
    changed := 0;

    FOR i IN 0 .. jsonb_array_length(new_days) - 1 LOOP
      day_obj := new_days->i;
      day_md  := COALESCE(day_obj->'metadata', '{}'::jsonb);
      day_q   := COALESCE(day_md->'quality', '{}'::jsonb);

      IF day_q ? 'dayMode' AND (day_q->>'dayMode') IS NOT NULL AND length(day_q->>'dayMode') > 0 THEN
        CONTINUE;
      END IF;

      cached_mode := day_q #>> '{meal_policy_at_generation,dayMode}';
      IF cached_mode IS NULL OR length(cached_mode) = 0 THEN
        CONTINUE;
      END IF;

      day_q   := jsonb_set(day_q, '{dayMode}', to_jsonb(cached_mode), true);
      day_md  := jsonb_set(day_md, '{quality}', day_q, true);
      day_obj := jsonb_set(day_obj, '{metadata}', day_md, true);
      new_days := jsonb_set(new_days, ARRAY[i::text], day_obj, true);
      changed := changed + 1;
    END LOOP;

    IF changed > 0 THEN
      UPDATE public.trips
      SET itinerary_data = jsonb_set(itinerary_data, '{days}', new_days, true)
      WHERE id = trip_row.id;
      affected_trips := affected_trips + 1;
      RAISE NOTICE '[BACKFILL_DAYMODE] trip=% promoted=% day(s)', trip_row.id, changed;
    END IF;
  END LOOP;

  RAISE NOTICE '[BACKFILL_DAYMODE] total trips touched=%', affected_trips;
END $$;