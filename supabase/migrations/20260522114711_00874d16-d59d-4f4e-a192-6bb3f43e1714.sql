-- Observability view for chronology integrity. Lists trips whose last
-- persist boundary stamped a critical chronology issue that survived the
-- auto-heal. Triage target: 0 rows.
-- See mem://constraints/itinerary/chronology-validator-three-gates.
CREATE OR REPLACE VIEW public.trips_with_chronology_issues
WITH (security_invoker = true)
AS
SELECT
  id AS trip_id,
  user_id,
  destination,
  itinerary_status,
  (metadata->'quality'->'chronology_trace'->>'at')::timestamptz AS traced_at,
  (metadata->'quality'->'chronology_trace'->>'issues_pre')::int  AS issues_pre,
  (metadata->'quality'->'chronology_trace'->>'issues_post')::int AS issues_post,
  (metadata->'quality'->'chronology_trace'->>'sorted_days')::int AS sorted_days,
  (metadata->'quality'->'chronology_trace'->>'dropped')::int     AS dropped,
  (metadata->'quality'->'chronology_trace'->>'critical_after_heal')::boolean AS critical_after_heal,
  metadata->'quality'->'chronology_trace'->'sample' AS sample
FROM public.trips
WHERE metadata->'quality'->'chronology_trace' IS NOT NULL
  AND (metadata->'quality'->'chronology_trace'->>'critical_after_heal')::boolean = true;

COMMENT ON VIEW public.trips_with_chronology_issues IS
  'Trips whose last persist boundary recorded a critical chronology issue (predawn non-bookend / backward jump) that survived auto-heal. Target: 0 rows.';