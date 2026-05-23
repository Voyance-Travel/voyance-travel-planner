-- Backfill: strip untimed locked anchor cards from legacy itinerary_data.
-- These rows have no startTime, no time, no description, no cost — pure noise
-- that renders as a floating duplicated bare card. Safe to remove (budget-neutral).
-- See mem://constraints/itinerary/anchor-cards-must-have-time.

WITH cleaned AS (
  SELECT
    t.id AS trip_id,
    jsonb_set(
      t.itinerary_data,
      '{days}',
      (
        SELECT jsonb_agg(
          jsonb_set(
            d,
            '{activities}',
            COALESCE(
              (
                SELECT jsonb_agg(a)
                FROM jsonb_array_elements(d->'activities') a
                WHERE NOT (
                  COALESCE((a->>'isLocked')::boolean, false) IS TRUE
                  AND (a->>'startTime') IS NULL
                  AND (a->>'time') IS NULL
                  AND (a->>'start_time') IS NULL
                )
              ),
              '[]'::jsonb
            )
          )
          ORDER BY (d->>'dayNumber')::int
        )
        FROM jsonb_array_elements(t.itinerary_data->'days') d
      )
    ) AS new_itinerary
  FROM trips t
  WHERE t.itinerary_data IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(t.itinerary_data->'days') d,
           jsonb_array_elements(d->'activities') a
      WHERE COALESCE((a->>'isLocked')::boolean, false) IS TRUE
        AND (a->>'startTime') IS NULL
        AND (a->>'time') IS NULL
        AND (a->>'start_time') IS NULL
    )
)
UPDATE trips t
SET itinerary_data = c.new_itinerary,
    metadata = COALESCE(t.metadata, '{}'::jsonb) || jsonb_build_object(
      'anchor_cleanup_at', now()
    )
FROM cleaned c
WHERE t.id = c.trip_id;