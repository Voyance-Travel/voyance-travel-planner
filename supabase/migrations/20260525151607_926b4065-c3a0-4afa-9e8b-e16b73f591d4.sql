CREATE OR REPLACE VIEW public.trips_with_audit_violations AS
SELECT
  t.id AS trip_id,
  t.user_id,
  t.destination,
  (t.metadata->'quality'->'read_time_audit'->>'at')::timestamptz AS audited_at,
  v.code,
  v.severity,
  v.day_number,
  v.detail,
  COALESCE(v.activity_ids, '[]'::jsonb) AS activity_ids,
  NULLIF(t.metadata->'quality'->'read_time_audit'->>'parity_delta','')::int AS parity_delta,
  NULLIF(t.metadata->'quality'->'read_time_audit'->>'json_activity_count','')::int AS json_activity_count,
  NULLIF(t.metadata->'quality'->'read_time_audit'->>'table_activity_count','')::int AS table_activity_count
FROM public.trips t
CROSS JOIN LATERAL (
  SELECT
    elem->>'code' AS code,
    elem->>'severity' AS severity,
    NULLIF(elem->>'dayNumber','')::int AS day_number,
    elem->>'detail' AS detail,
    elem->'activityIds' AS activity_ids
  FROM jsonb_array_elements(
    COALESCE(t.metadata->'quality'->'read_time_audit'->'violations', '[]'::jsonb)
  ) AS elem
) v
WHERE t.metadata ? 'quality'
  AND t.metadata->'quality' ? 'read_time_audit';

COMMENT ON VIEW public.trips_with_audit_violations IS
  'One row per timing audit violation. Sourced from trips.metadata.quality.read_time_audit (audit-trip-timing edge fn). Owner-readable via underlying trips RLS.';

GRANT SELECT ON public.trips_with_audit_violations TO authenticated;