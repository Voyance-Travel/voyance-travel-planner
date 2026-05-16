WITH candidate AS (
  SELECT id, metadata->'userAnchors' AS anchors
  FROM trips
  WHERE jsonb_typeof(metadata->'userAnchors') = 'array'
),
exploded AS (
  SELECT c.id, x.a, x.ord
  FROM candidate c
  CROSS JOIN LATERAL jsonb_array_elements(c.anchors) WITH ORDINALITY AS x(a, ord)
),
cleaned AS (
  SELECT
    id,
    COALESCE(
      jsonb_agg(a ORDER BY ord) FILTER (
        WHERE COALESCE(NULLIF(a->>'startTime', ''), NULL) IS NOT NULL
          AND COALESCE((a->>'dayNumber')::int, 0) >= 1
      ),
      '[]'::jsonb
    ) AS kept,
    COUNT(*) FILTER (
      WHERE NOT (
        COALESCE(NULLIF(a->>'startTime', ''), NULL) IS NOT NULL
        AND COALESCE((a->>'dayNumber')::int, 0) >= 1
      )
    ) AS dropped_count
  FROM exploded
  GROUP BY id
)
UPDATE trips t
SET metadata = jsonb_set(t.metadata, '{userAnchors}', c.kept, true)
FROM cleaned c
WHERE t.id = c.id
  AND c.dropped_count > 0;