-- Rome trip one-shot heal: rewrite Day 1 activities for d18b2e8a-310e-42c8-a7aa-aac61076a234
-- Strategy: walk JSON, repair the broken dinner card, drop confirmed-corrupt rows.
WITH t AS (
  SELECT id, itinerary_data, metadata FROM trips WHERE id = 'd18b2e8a-310e-42c8-a7aa-aac61076a234'
),
day1 AS (
  SELECT id,
         itinerary_data,
         metadata,
         itinerary_data->'days'->0 AS day0,
         (itinerary_data->'days'->0->'activities') AS acts
  FROM t
),
repaired AS (
  SELECT id,
         itinerary_data,
         metadata,
         day0,
         (
           SELECT jsonb_agg(
             CASE
               -- Fix the Roscioli dinner: 00:00 -> 19:30, end 21:00
               WHEN a->>'title' = 'Dinner: Roscioli Salumeria con Cucina' THEN
                 jsonb_set(
                   jsonb_set(
                     jsonb_set(
                       jsonb_set(
                         jsonb_set(a, '{startTime}', '"19:30"'),
                         '{start_time}', '"19:30"'),
                       '{time}', '"19:30"'),
                     '{endTime}', '"21:00"'),
                   '{end_time}', '"21:00"')
               ELSE a
             END
             ORDER BY ord
           )
           FROM jsonb_array_elements(acts) WITH ORDINALITY arr(a, ord)
           WHERE
             -- Drop the duplicate/orphan hotel-related entries on Day 1.
             NOT (
               -- Travel to Hotel @ 23:50 — orphan, after Colosseum is dropped/handled
               (a->>'title' = 'Travel to Hotel de Russie, a Rocco Forte hotel'
                AND a->>'startTime' = '23:50')
               -- Final "Return to Hotel @ 23:59" — duplicate of the 23:41 one
               OR (a->>'title' = 'Return to Hotel de Russie, a Rocco Forte hotel'
                   AND a->>'startTime' = '23:59')
             )
         ) AS new_acts
  FROM day1
)
UPDATE trips SET
  itinerary_data = jsonb_set(
    r.itinerary_data,
    '{days,0,activities}',
    r.new_acts
  ),
  metadata = COALESCE(r.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'fully_persisted', false,
      'pending_sanitize_resave', jsonb_build_object(
        'at', to_jsonb(now()),
        'reason', 'rome_day1_oneshot_heal'
      )
    ),
  updated_at = now()
FROM repaired r
WHERE trips.id = r.id;