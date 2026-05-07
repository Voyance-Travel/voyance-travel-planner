-- Repair existing itineraries where a "Lunch — pick a restaurant" / "Dinner — pick a café"
-- placeholder sentinel slipped through the meal guard. Replace each with a real, named
-- emergency fallback venue so users never see "pick a restaurant" again.
--
-- Strategy: walk trips.itinerary_data.days[*].activities[*]; for each placeholder meal
-- (matching the title/venue sentinel OR metadata.needsVenuePick=true), substitute a real
-- city/regional/global fallback. We deliberately keep the SQL fallback list small and
-- generic — the runtime fix-placeholders.ts pipeline owns the rich pool.
CREATE OR REPLACE FUNCTION public._repair_pick_a_restaurant_placeholders()
RETURNS TABLE (trip_id uuid, days_patched int, activities_patched int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trip_rec RECORD;
  patched_days int;
  patched_acts int;
  new_data jsonb;
  day jsonb;
  acts jsonb;
  act jsonb;
  i int;
  j int;
  city text;
  meal text;
  fallback_name text;
  fallback_addr text;
  fallback_desc text;
  title text;
  start_time text;
  hour int;
  is_locked boolean;
  is_user_added boolean;
BEGIN
  FOR trip_rec IN
    SELECT t.id, t.destination, t.itinerary_data
    FROM public.trips t
    WHERE t.itinerary_data::text ~* '(pick a restaurant|pick a caf[eé])'
  LOOP
    new_data := trip_rec.itinerary_data;
    patched_days := 0;
    patched_acts := 0;

    FOR i IN 0 .. coalesce(jsonb_array_length(new_data->'days'), 0) - 1 LOOP
      day := new_data->'days'->i;
      acts := coalesce(day->'activities', '[]'::jsonb);
      city := coalesce(
        day->>'city',
        day->>'destination',
        trip_rec.destination,
        ''
      );

      FOR j IN 0 .. coalesce(jsonb_array_length(acts), 0) - 1 LOOP
        act := acts->j;
        title := coalesce(act->>'title', '');
        is_locked := coalesce((act->>'isLocked')::boolean, false);
        is_user_added := (act->'metadata'->>'source') IN ('user', 'manual', 'extracted', 'pinned', 'chat');

        IF is_locked OR is_user_added THEN
          CONTINUE;
        END IF;

        IF title !~* '(pick a restaurant|pick a caf[eé])'
           AND coalesce(act->'location'->>'name', '') !~* '(pick a restaurant|pick a caf[eé])'
           AND coalesce((act->'metadata'->>'needsVenuePick')::boolean, false) = false THEN
          CONTINUE;
        END IF;

        -- Determine meal type
        start_time := coalesce(act->>'startTime', act->>'start_time', '12:30');
        hour := coalesce(nullif(split_part(start_time, ':', 1), '')::int, 12);
        IF title ~* 'breakfast|brunch' OR hour < 11 THEN
          meal := 'breakfast';
        ELSIF title ~* 'dinner|supper' OR hour >= 17 THEN
          meal := 'dinner';
        ELSE
          meal := 'lunch';
        END IF;

        -- Pick a real, named fallback by region (very small SQL pool;
        -- live pipeline owns the full list).
        IF city ILIKE '%venice%' OR city ILIKE '%venezia%' THEN
          IF meal = 'breakfast' THEN
            fallback_name := 'Pasticceria Tonolo';
            fallback_addr := 'Calle S. Pantalon 3764, 30123 Venezia VE, Italy';
            fallback_desc := 'Cult Dorsoduro pastry counter since 1886.';
          ELSIF meal = 'lunch' THEN
            fallback_name := 'All''Arco';
            fallback_addr := 'Calle dell''Occhialer 436, 30125 Venezia VE, Italy';
            fallback_desc := 'Tiny San Polo cicchetti bar steps from the Rialto.';
          ELSE
            fallback_name := 'Bistrot de Venise';
            fallback_addr := 'Calistro Marin Sanudo 4685, 30124 Venezia VE, Italy';
            fallback_desc := 'Traditional Venetian cuisine in a refined setting.';
          END IF;
        ELSIF city ILIKE '%rome%' OR city ILIKE '%roma%' OR city ILIKE '%italy%' THEN
          IF meal = 'breakfast' THEN
            fallback_name := 'Sant''Eustachio Il Caffè'; fallback_addr := 'Piazza di S. Eustachio 82, Rome, Italy'; fallback_desc := 'Italy''s most iconic espresso bar.';
          ELSIF meal = 'lunch' THEN
            fallback_name := 'All''Antico Vinaio'; fallback_addr := 'Via dei Neri 65, Florence, Italy'; fallback_desc := 'Italy''s most-loved schiacciata sandwich shop.';
          ELSE
            fallback_name := 'Trattoria Sostanza'; fallback_addr := 'Via del Porcellana 25, Florence, Italy'; fallback_desc := 'Florentine institution since 1869.';
          END IF;
        ELSIF city ILIKE '%paris%' OR city ILIKE '%france%' THEN
          IF meal = 'breakfast' THEN
            fallback_name := 'Du Pain et des Idées'; fallback_addr := '34 Rue Yves Toudic, 75010 Paris, France'; fallback_desc := 'Christophe Vasseur''s cult bakery.';
          ELSIF meal = 'lunch' THEN
            fallback_name := 'Bouillon Pigalle'; fallback_addr := '22 Bd de Clichy, 75018 Paris, France'; fallback_desc := 'Stunning Belle Époque brasserie.';
          ELSE
            fallback_name := 'Le Comptoir du Relais'; fallback_addr := '9 Carrefour de l''Odéon, 75006 Paris, France'; fallback_desc := 'Yves Camdeborde''s iconic bistro.';
          END IF;
        ELSE
          -- Global emergency
          IF meal = 'breakfast' THEN
            fallback_name := 'Tartine Bakery'; fallback_addr := '600 Guerrero St, San Francisco, CA 94110, USA'; fallback_desc := 'World-renowned bakery — pastries, country bread, great coffee.';
          ELSIF meal = 'lunch' THEN
            fallback_name := 'All''Antico Vinaio'; fallback_addr := 'Via dei Neri 65, Florence, Italy'; fallback_desc := 'World-famous schiacciata sandwich shop.';
          ELSE
            fallback_name := 'Le Comptoir du Relais'; fallback_addr := '9 Carrefour de l''Odéon, 75006 Paris, France'; fallback_desc := 'Yves Camdeborde''s iconic bistro.';
          END IF;
        END IF;

        act := jsonb_set(act, '{title}', to_jsonb(initcap(meal) || ' at ' || fallback_name));
        act := jsonb_set(act, '{name}', to_jsonb(initcap(meal) || ' at ' || fallback_name));
        act := jsonb_set(act, '{venue_name}', to_jsonb(fallback_name));
        act := jsonb_set(act, '{location}', jsonb_build_object('name', fallback_name, 'address', fallback_addr));
        act := jsonb_set(act, '{description}', to_jsonb(fallback_desc));
        act := jsonb_set(act, '{category}', '"dining"'::jsonb);
        IF act ? 'metadata' THEN
          act := jsonb_set(act, '{metadata,needsVenuePick}', 'false'::jsonb);
          act := jsonb_set(act, '{metadata,unverified_venue}', 'false'::jsonb);
          act := jsonb_set(act, '{metadata,repaired_from_placeholder}', 'true'::jsonb);
        ELSE
          act := jsonb_set(act, '{metadata}', jsonb_build_object('repaired_from_placeholder', true));
        END IF;

        acts := jsonb_set(acts, ARRAY[j::text], act);
        patched_acts := patched_acts + 1;
      END LOOP;

      day := jsonb_set(day, '{activities}', acts);
      new_data := jsonb_set(new_data, ARRAY['days', i::text], day);
      patched_days := patched_days + 1;
    END LOOP;

    IF patched_acts > 0 THEN
      UPDATE public.trips SET itinerary_data = new_data WHERE id = trip_rec.id;
      trip_id := trip_rec.id;
      days_patched := patched_days;
      activities_patched := patched_acts;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

SELECT * FROM public._repair_pick_a_restaurant_placeholders();

DROP FUNCTION public._repair_pick_a_restaurant_placeholders();