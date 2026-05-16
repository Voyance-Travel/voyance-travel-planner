-- Backfill bare-neighborhood addresses so Google Maps doesn't ambiguously resolve to the wrong city.
-- Affects both the side-mirror itinerary_activities table and the canonical trips.itinerary_data JSON.

-- 1) itinerary_activities: append ", <destination>" to addresses missing a comma and not already containing destination
UPDATE itinerary_activities ia
SET location = jsonb_set(
  ia.location,
  '{address}',
  to_jsonb((ia.location->>'address') || ', ' || t.destination)
)
FROM trips t
WHERE ia.trip_id = t.id
  AND ia.location ? 'address'
  AND length(coalesce(ia.location->>'address','')) > 0
  AND position(',' in (ia.location->>'address')) = 0
  AND t.destination IS NOT NULL
  AND length(t.destination) > 0
  AND position(lower(t.destination) in lower(ia.location->>'address')) = 0;

-- 2) trips.itinerary_data->days[*]->activities[*]->location.address: same normalization, JSON in-place
UPDATE trips t
SET itinerary_data = jsonb_set(
  itinerary_data,
  '{days}',
  COALESCE((
    SELECT jsonb_agg(
      CASE
        WHEN day ? 'activities' THEN
          jsonb_set(day, '{activities}', COALESCE((
            SELECT jsonb_agg(
              CASE
                WHEN act ? 'location'
                  AND act->'location' ? 'address'
                  AND length(coalesce(act->'location'->>'address','')) > 0
                  AND position(',' in act->'location'->>'address') = 0
                  AND position(lower(t.destination) in lower(act->'location'->>'address')) = 0
                THEN jsonb_set(act, '{location,address}',
                       to_jsonb((act->'location'->>'address') || ', ' || t.destination))
                ELSE act
              END
            ) FROM jsonb_array_elements(day->'activities') act
          ), '[]'::jsonb))
        ELSE day
      END
    ) FROM jsonb_array_elements(itinerary_data->'days') day
  ), '[]'::jsonb)
)
WHERE itinerary_data ? 'days'
  AND jsonb_typeof(itinerary_data->'days') = 'array'
  AND destination IS NOT NULL
  AND length(destination) > 0;