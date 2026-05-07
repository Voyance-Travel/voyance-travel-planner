WITH bad AS (
  SELECT
    d.id,
    COALESCE(
      jsonb_agg(a ORDER BY ord) FILTER (
        WHERE NOT (
          (
            (a->>'time')      ~ '^0[0-4]:' OR
            (a->>'startTime') ~ '^0[0-4]:' OR
            (a->>'start_time')~ '^0[0-4]:'
          )
          AND (
            (a->>'title') ~* '\m(return to|check.?in|check.?out|freshen up|settle in|wind down|back to)\M'
            OR LOWER(COALESCE(a->>'category','')) IN ('accommodation','stay')
          )
        )
      ),
      '[]'::jsonb
    ) AS new_activities
  FROM itinerary_days d
  CROSS JOIN LATERAL jsonb_array_elements(d.activities) WITH ORDINALITY AS arr(a, ord)
  WHERE d.created_at > now() - interval '7 days'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(d.activities) a2
      WHERE (
              (a2->>'time')      ~ '^0[0-4]:' OR
              (a2->>'startTime') ~ '^0[0-4]:' OR
              (a2->>'start_time')~ '^0[0-4]:'
            )
        AND (
          (a2->>'title') ~* '\m(return to|check.?in|check.?out|freshen up|settle in|wind down|back to)\M'
          OR LOWER(COALESCE(a2->>'category','')) IN ('accommodation','stay')
        )
    )
  GROUP BY d.id
)
UPDATE itinerary_days d
SET activities = bad.new_activities,
    updated_at = now()
FROM bad
WHERE d.id = bad.id;