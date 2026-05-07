UPDATE public.activity_costs ac
SET cost_per_person_usd = 0,
    source = 'unverified_meal',
    confidence = 'low',
    notes = COALESCE(ac.notes, '') || ' [auto-zero: highly-rated stub]'
FROM public.trips t
WHERE ac.trip_id = t.id
  AND ac.cost_per_person_usd > 0
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(t.itinerary_data->'days', '[]'::jsonb)) AS d(day),
         jsonb_array_elements(COALESCE(d.day->'activities', '[]'::jsonb)) AS a(act)
    WHERE a.act->>'id' = ac.activity_id
      AND (
        a.act->>'title' ILIKE '%highly-rated neighborhood%'
        OR a.act->'location'->>'name' ILIKE '%highly-rated neighborhood%'
        OR a.act->>'venue_name' ILIKE '%highly-rated neighborhood%'
        OR a.act->>'title' ILIKE '%— pick a restaurant%'
        OR a.act->>'title' ILIKE '%- pick a restaurant%'
      )
  );