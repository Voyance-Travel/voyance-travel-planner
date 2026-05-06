-- ============================================================================
-- Sync activity_costs → trips.itinerary_data.days[].activities[].cost
-- ============================================================================
-- The card and the budget were drifting because two stores held the same
-- fact: trips.itinerary_data.cost.amount (read by the card) and
-- activity_costs.cost_per_person_usd (read by the budget). This trigger
-- makes activity_costs the only writer and projects its value back into
-- the JSONB on every change, in the same transaction.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_activity_cost_to_itinerary_jsonb()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_trip_id   uuid;
  v_act_id    text;
  v_total     numeric;
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
    v_total   := v_per_pp * COALESCE(NEW.num_travelers, 1);
    v_source  := COALESCE(NEW.source, 'unknown');
    v_cost_obj := jsonb_build_object(
      'amount', v_total,
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
  -- jsonb_set on a deeply-nested array element with an unknown index is
  -- awkward, so we rebuild the days array. This runs once per cost write
  -- (small N) and stays inside the same transaction.
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
$$;

DROP TRIGGER IF EXISTS sync_activity_cost_to_itinerary_jsonb_trigger ON public.activity_costs;

CREATE TRIGGER sync_activity_cost_to_itinerary_jsonb_trigger
AFTER INSERT OR UPDATE OF cost_per_person_usd, num_travelers, source
                OR DELETE
ON public.activity_costs
FOR EACH ROW
EXECUTE FUNCTION public.sync_activity_cost_to_itinerary_jsonb();

-- ============================================================================
-- ONE-SHOT BACKFILL
-- Realign every trip's JSONB to the current ledger by touching each row.
-- The trigger does the projection; this UPDATE just nudges every row.
-- ============================================================================
DO $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.activity_costs
  SET cost_per_person_usd = cost_per_person_usd
  WHERE cost_per_person_usd IS NOT NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[sync_activity_cost_to_itinerary_jsonb] Backfilled % rows', v_count;
END;
$$;