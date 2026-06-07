-- FIX (CRITICAL): cost-doubling feedback loop in the activity_costs -> itinerary_data
-- reverse-sync trigger.
--
-- The trigger `sync_activity_cost_to_itinerary_jsonb` wrote the GROUP total
-- (cost_per_person_usd * num_travelers) into `act.cost.amount`. But every reader
-- in the app treats `act.cost.amount` as a PER-PERSON value (resolvePerPersonForDb
-- returns `amount` as-is for the default/per_person/ledger basis). So the round-trip
-- was not idempotent:
--   activity_costs.cpp = P
--   -> trigger writes act.cost.amount = P * travelers   (e.g. 2P)
--   -> next client sync: resolvePerPersonForDb(amount=2P) = 2P -> writes cpp = 2P
--   -> trigger writes amount = 2P * travelers = 4P ... doubling every sync.
-- Symptom: day-cost badges + budget ledger inflate by ~x num_travelers on every
-- reorder / edit / load (Madrid day-1 observed climbing 590 -> 1150 -> 2270 -> 4510 -> 8358).
--
-- Fix: write the PER-PERSON value into `amount` (amount == perPerson == cpp), so the
-- representation is self-consistent and the round-trip is a fixed point. Group totals
-- are derived as perPerson * travelers at display time, never stored back into `amount`.
CREATE OR REPLACE FUNCTION public.sync_activity_cost_to_itinerary_jsonb()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_trip_id   uuid;
  v_act_id    text;
  v_per_pp    numeric;
  v_source    text;
  v_cost_obj  jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_trip_id := OLD.trip_id;
    v_act_id  := OLD.activity_id;
    v_cost_obj := jsonb_build_object(
      'amount', 0,
      'currency', 'USD',
      'perPerson', 0,
      'basis', 'ledger',
      'source', 'deleted',
      'synced_at', to_jsonb(now())
    );
  ELSE
    v_trip_id := NEW.trip_id;
    v_act_id  := NEW.activity_id;
    v_per_pp  := COALESCE(NEW.cost_per_person_usd, 0);
    v_source  := COALESCE(NEW.source, 'unknown');
    -- BUGFIX: `amount` must be PER-PERSON (not cpp * num_travelers). Writing the
    -- group total here was the source of the x-num_travelers cost-doubling loop.
    v_cost_obj := jsonb_build_object(
      'amount', v_per_pp,
      'currency', 'USD',
      'perPerson', v_per_pp,
      'basis', 'ledger',
      'source', v_source,
      'synced_at', to_jsonb(now())
    );
  END IF;

  IF v_trip_id IS NULL OR v_act_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Walk days[].activities[] and rewrite the cost on the matching activity.
  UPDATE public.trips t
  SET itinerary_data = jsonb_set(
    t.itinerary_data,
    '{days}',
    COALESCE((
      SELECT jsonb_agg(
        CASE
          WHEN day ? 'activities' AND jsonb_typeof(day->'activities') = 'array' THEN
            jsonb_set(
              day,
              '{activities}',
              COALESCE((
                SELECT jsonb_agg(
                  CASE
                    WHEN act->>'id' = v_act_id
                      THEN jsonb_set(jsonb_set(act, '{cost}', v_cost_obj, true), '{estimatedCost}', v_cost_obj, true)
                    ELSE act
                  END
                  ORDER BY a_ord
                )
                FROM jsonb_array_elements(day->'activities') WITH ORDINALITY AS a(act, a_ord)
              ), '[]'::jsonb)
            )
          ELSE day
        END
        ORDER BY d_ord
      )
      FROM jsonb_array_elements(t.itinerary_data->'days') WITH ORDINALITY AS d(day, d_ord)
    ), '[]'::jsonb)
  )
  WHERE t.id = v_trip_id
    AND t.itinerary_data IS NOT NULL
    AND t.itinerary_data ? 'days'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(t.itinerary_data->'days') AS d(day),
           jsonb_array_elements(COALESCE(d.day->'activities', '[]'::jsonb)) AS a(act)
      WHERE a.act->>'id' = v_act_id
    );

  RETURN COALESCE(NEW, OLD);
END;
$function$;
