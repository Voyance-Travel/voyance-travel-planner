-- One-shot heal for trip 44a68e13-45f3-4edf-b1c3-c548bea1ebc1 (Milan, Jun 4-6 2026)
-- Plan D of audit 44a68e13:
--   1. Drop 6 mis-timed pre-dawn Day 1 cards (01:44-08:10 phantom block) — these
--      were a duplicate AM itinerary the LLM emitted alongside the real day starting
--      at 08:15 check-in.
--   2. Drop the post-checkout 10:35 walk on Day 3 (overlaps 11:00 checkout).
--   3. Backfill metadata.savedDepartureTime24 from Day 3 checkout end (11:30) so
--      future saves don't re-derive missing-lunch errors.
--   4. Clear metadata.persist_validation so the recorded errors don't stick.

WITH src AS (
  SELECT itinerary_data, metadata FROM trips
  WHERE id = '44a68e13-45f3-4edf-b1c3-c548bea1ebc1'
),
day1_filtered AS (
  SELECT jsonb_agg(a ORDER BY a->>'startTime') AS acts
  FROM src, jsonb_array_elements(src.itinerary_data->'days'->0->'activities') a
  WHERE a->>'id' NOT IN (
    'fda52976-b728-43fd-b8bb-4a8c6cbf7224', -- Breakfast Pavé 01:44
    '4b325812-58f2-422b-a431-6057fea44ff7', -- Duomo 03:09
    'a6ce15e6-4b63-40bc-b107-169389afe668', -- Lunch Giacomo 04:57
    '6689d63c-9ea0-41cf-a169-2eaeb70b6978', -- Metro to 5 Vie 06:02
    '41cb2ef3-121b-45d6-9959-f553329dc916'  -- Free roam 5 Vie 06:19
  )
  AND a->>'id' != 'transport-gap-1-1779447627524-wtcy' -- Travel to hotel 07:54
),
day3_filtered AS (
  SELECT jsonb_agg(a ORDER BY a->>'startTime') AS acts
  FROM src, jsonb_array_elements(src.itinerary_data->'days'->2->'activities') a
  WHERE lower(coalesce(a->>'title','')) NOT LIKE '%golden hour group walk%'
)
UPDATE trips t SET
  itinerary_data = jsonb_set(
    jsonb_set(
      src.itinerary_data,
      '{days,0,activities}',
      coalesce(day1_filtered.acts, '[]'::jsonb)
    ),
    '{days,2,activities}',
    coalesce(day3_filtered.acts, '[]'::jsonb)
  ),
  metadata = (src.metadata - 'persist_validation') || jsonb_build_object(
    'savedDepartureTime24', '11:30',
    'savedDepartureTime24_source', 'heal_44a68e13_checkout',
    'audit_44a68e13_healed_at', to_jsonb(now())
  )
FROM src, day1_filtered, day3_filtered
WHERE t.id = '44a68e13-45f3-4edf-b1c3-c548bea1ebc1';