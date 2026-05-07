UPDATE activity_costs ac
SET cost_per_person_usd = 0,
    source = 'walking_free',
    notes = '[Walking — free]',
    confidence = 'high'
FROM trips t,
     LATERAL jsonb_array_elements(COALESCE(t.itinerary_data->'days', t.itinerary_data->'itinerary'->'days', '[]'::jsonb)) AS d,
     LATERAL jsonb_array_elements(COALESCE(d->'activities', '[]'::jsonb)) AS a
WHERE ac.trip_id = t.id
  AND ac.activity_id::text = a->>'id'
  AND ac.cost_per_person_usd > 0
  AND (
    (a->>'title') ~* '^\s*(walk|stroll)\b'
    OR (a->>'title') ~* '\bwalking\s+(to|along|through)\b'
  )
  AND NOT (
    (a->>'title') ~* '\bwalking\s+tour\b'
    AND COALESCE((a->>'booking_required')::boolean, false) = true
  );