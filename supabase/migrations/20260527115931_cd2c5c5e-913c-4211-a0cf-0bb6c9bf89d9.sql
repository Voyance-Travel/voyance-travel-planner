-- 20260527_clamp_legacy_bookend_wrap.sql (v2 — null-guarded bounds)
DO $$
DECLARE
  trip_rec RECORD;
  new_data jsonb;
  day_idx int;
  act_idx int;
  day_obj jsonb;
  act_obj jsonb;
  days_len int;
  acts_len int;
  st text;
  et text;
  src text;
  cat text;
  ttl text;
  start_min int;
  end_min int;
  patched_count int := 0;
  trip_patched int;
  total_trips_patched int := 0;
BEGIN
  FOR trip_rec IN
    SELECT id, itinerary_data
    FROM public.trips
    WHERE itinerary_data IS NOT NULL
      AND jsonb_typeof(itinerary_data -> 'days') = 'array'
      AND jsonb_array_length(itinerary_data -> 'days') > 0
  LOOP
    new_data := trip_rec.itinerary_data;
    trip_patched := 0;
    days_len := COALESCE(jsonb_array_length(new_data -> 'days'), 0);

    FOR day_idx IN 0 .. (days_len - 1) LOOP
      day_obj := new_data -> 'days' -> day_idx;
      IF day_obj IS NULL OR jsonb_typeof(day_obj -> 'activities') <> 'array' THEN CONTINUE; END IF;
      acts_len := COALESCE(jsonb_array_length(day_obj -> 'activities'), 0);
      IF acts_len = 0 THEN CONTINUE; END IF;

      FOR act_idx IN 0 .. (acts_len - 1) LOOP
        act_obj := day_obj -> 'activities' -> act_idx;
        IF act_obj IS NULL THEN CONTINUE; END IF;

        st  := COALESCE(act_obj ->> 'startTime', act_obj ->> 'start_time', act_obj ->> 'time');
        et  := COALESCE(act_obj ->> 'endTime',   act_obj ->> 'end_time');
        src := lower(COALESCE(act_obj ->> 'source', ''));
        cat := lower(COALESCE(act_obj ->> 'category', ''));
        ttl := COALESCE(act_obj ->> 'title', act_obj ->> 'name', '');

        IF st IS NULL OR et IS NULL THEN CONTINUE; END IF;
        IF src IN ('late_nightlife_bookend', 'user', 'manual', 'extracted', 'pinned', 'booked') THEN CONTINUE; END IF;
        BEGIN
          IF (act_obj ->> 'isLocked')::boolean IS TRUE THEN CONTINUE; END IF;
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;

        IF NOT (cat IN ('stay', 'accommodation') OR ttl ~* '^(return to|head back to|wind[- ]?down|retire|end of day at)') THEN
          CONTINUE;
        END IF;

        BEGIN
          start_min := EXTRACT(hour FROM st::time) * 60 + EXTRACT(minute FROM st::time);
          end_min   := EXTRACT(hour FROM et::time) * 60 + EXTRACT(minute FROM et::time);
        EXCEPTION WHEN OTHERS THEN
          CONTINUE;
        END;

        IF end_min < start_min THEN
          act_obj := jsonb_set(act_obj, '{endTime}',  '"23:59"'::jsonb, true);
          act_obj := jsonb_set(act_obj, '{end_time}', '"23:59"'::jsonb, true);
          act_obj := jsonb_set(act_obj, '{metadata,clamped_legacy_wrap}', 'true'::jsonb, true);
          day_obj := jsonb_set(day_obj, ARRAY['activities', act_idx::text], act_obj, true);
          new_data := jsonb_set(new_data, ARRAY['days', day_idx::text], day_obj, true);
          patched_count := patched_count + 1;
          trip_patched := trip_patched + 1;
        END IF;
      END LOOP;
    END LOOP;

    IF trip_patched > 0 THEN
      UPDATE public.trips
      SET itinerary_data = new_data,
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'legacy_bookend_wrap_clamp', jsonb_build_object(
              'at', to_jsonb(now()),
              'clamped', to_jsonb(trip_patched)
            )
          )
      WHERE id = trip_rec.id;
      total_trips_patched := total_trips_patched + 1;
    END IF;
  END LOOP;

  RAISE NOTICE '[clamp_legacy_bookend_wrap] trips_patched=% rows_clamped=%', total_trips_patched, patched_count;
END $$;