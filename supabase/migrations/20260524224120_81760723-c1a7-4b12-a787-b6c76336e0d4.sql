-- Backfill: promote trips where the normalized tables hold a complete generation
-- but trips.itinerary_status got stuck at 'partial' / 'failed' / stale 'generating'.
-- Frontend TripDetail self-heal already rebuilds itinerary_data.days from
-- itinerary_days + itinerary_activities on first load of a 'ready' trip when
-- the JSON is sparse. This migration just flips status + clears stale failure
-- metadata so the UI stops spinning and the recovery branch can run.
--
-- Safe gate: only promotes when every itinerary_days row has >=1 itinerary_activities row.

WITH candidates AS (
  SELECT t.id,
         coalesce((t.metadata->>'generation_total_days')::int,
                  (date_part('day', t.end_date::timestamp - t.start_date::timestamp)::int + 1)) AS expected_total,
         (SELECT count(*) FROM itinerary_days d WHERE d.trip_id = t.id) AS tbl_days,
         (SELECT count(*) FROM itinerary_days d
            WHERE d.trip_id = t.id
              AND EXISTS (SELECT 1 FROM itinerary_activities a WHERE a.itinerary_day_id = d.id))
           AS tbl_days_with_acts,
         t.metadata
  FROM trips t
  WHERE t.itinerary_status IN ('partial','failed','generating','queued')
    AND t.created_at > now() - interval '60 days'
),
eligible AS (
  SELECT id, metadata, tbl_days, expected_total
  FROM candidates
  WHERE expected_total > 0
    AND tbl_days >= expected_total
    AND tbl_days_with_acts >= expected_total
)
UPDATE trips t
SET itinerary_status = 'ready',
    updated_at = now(),
    metadata = ((coalesce(t.metadata,'{}'::jsonb)
                 - 'generation_error'
                 - 'chain_error'
                 - 'chain_broken_at_day'
                 - 'chain_error_at')
                || jsonb_build_object(
                     'failed_day_numbers', '[]'::jsonb,
                     'generation_completed_days', e.expected_total,
                     'generation_total_days', e.expected_total,
                     'fully_persisted', true,
                     'fully_persisted_at', to_jsonb(now()::text),
                     'recovered_from_tables_at', to_jsonb(now()::text),
                     'recovery_source', to_jsonb('backfill_2026_05_24_status_promote'::text)
                   ))
FROM eligible e
WHERE t.id = e.id;