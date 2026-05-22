-- Heal Milan trip 44a68e13: re-sort Day 1 JSON by startTime and rebuild
-- itinerary_activities from canonical itinerary_data so the normalized table
-- matches what the user sees.

-- 1) Re-sort Day 1 activities by startTime (Duomo 16:30 currently sits after
--    Dinner Cracco 19:00 because the heal inserted it without re-sorting).
WITH sorted_day1 AS (
  SELECT jsonb_agg(act ORDER BY (act->>'startTime')::text) AS acts
  FROM trips,
       LATERAL jsonb_array_elements(itinerary_data->'days'->0->'activities') AS act
  WHERE id = '44a68e13-45f3-4edf-b1c3-c548bea1ebc1'
)
UPDATE trips
SET itinerary_data = jsonb_set(
  itinerary_data,
  '{days,0,activities}',
  (SELECT acts FROM sorted_day1)
),
updated_at = now()
WHERE id = '44a68e13-45f3-4edf-b1c3-c548bea1ebc1';

-- 2) Wipe stale itinerary_activities for this trip and rebuild from JSON.
DELETE FROM itinerary_activities
WHERE trip_id = '44a68e13-45f3-4edf-b1c3-c548bea1ebc1';

INSERT INTO itinerary_activities (
  id, itinerary_day_id, trip_id, sort_order,
  title, name, description, category,
  start_time, end_time, duration_minutes,
  location, cost, tags, is_locked, booking_required,
  tips, photos, walking_distance, walking_time,
  transportation, rating, website, viator_product_code,
  suggested_for
)
SELECT
  CASE
    WHEN (act->>'id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (act->>'id')::uuid
    ELSE gen_random_uuid()
  END AS id,
  d.id AS itinerary_day_id,
  '44a68e13-45f3-4edf-b1c3-c548bea1ebc1'::uuid AS trip_id,
  (ord - 1)::int AS sort_order,
  COALESCE(act->>'title', act->>'name', 'Activity') AS title,
  COALESCE(act->>'name', act->>'title') AS name,
  act->>'description' AS description,
  COALESCE(act->>'category', 'activity') AS category,
  COALESCE(act->>'startTime', act->>'start_time') AS start_time,
  COALESCE(act->>'endTime', act->>'end_time') AS end_time,
  NULLIF(act->>'durationMinutes','')::int AS duration_minutes,
  act->'location' AS location,
  act->'cost' AS cost,
  CASE WHEN jsonb_typeof(act->'tags')='array'
       THEN ARRAY(SELECT jsonb_array_elements_text(act->'tags'))
       ELSE NULL END AS tags,
  COALESCE((act->>'isLocked')::boolean, (act->>'locked')::boolean, false) AS is_locked,
  COALESCE((act->>'bookingRequired')::boolean, false) AS booking_required,
  act->>'tips' AS tips,
  act->'photos' AS photos,
  act->>'walkingDistance' AS walking_distance,
  act->>'walkingTime' AS walking_time,
  act->'transportation' AS transportation,
  act->'rating' AS rating,
  act->>'website' AS website,
  act->>'viatorProductCode' AS viator_product_code,
  act->>'suggestedFor' AS suggested_for
FROM trips t
CROSS JOIN LATERAL jsonb_array_elements(t.itinerary_data->'days') WITH ORDINALITY AS d_json(day_json, day_ord)
JOIN itinerary_days d
  ON d.trip_id = t.id
 AND d.day_number = (day_json->>'dayNumber')::int
CROSS JOIN LATERAL jsonb_array_elements(day_json->'activities') WITH ORDINALITY AS a(act, ord)
WHERE t.id = '44a68e13-45f3-4edf-b1c3-c548bea1ebc1';