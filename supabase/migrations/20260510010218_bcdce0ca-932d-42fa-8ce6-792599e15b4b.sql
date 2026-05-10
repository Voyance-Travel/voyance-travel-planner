-- Prune itinerary_versions to keep at most 30 versions per trip total.
-- Existing per-day cap is 10 (cleanup_old_itinerary_versions trigger);
-- this caps the global per-trip count to prevent unbounded growth on
-- long, heavily-edited trips. is_current rows are preserved as a safety.

CREATE OR REPLACE FUNCTION public.prune_itinerary_versions_per_trip()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pruned int := 0;
BEGIN
  WITH ranked AS (
    SELECT id,
           is_current,
           row_number() OVER (PARTITION BY trip_id ORDER BY created_at DESC) AS rn
    FROM public.itinerary_versions
  )
  DELETE FROM public.itinerary_versions
  WHERE id IN (
    SELECT id FROM ranked
    WHERE rn > 30 AND COALESCE(is_current, false) = false
  );
  GET DIAGNOSTICS v_pruned = ROW_COUNT;
  RETURN jsonb_build_object('pruned', v_pruned, 'ran_at', now());
END $$;

REVOKE ALL ON FUNCTION public.prune_itinerary_versions_per_trip() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_itinerary_versions_per_trip() TO service_role;

-- Idempotent reschedule: drop any existing job of the same name first.
DO $$
DECLARE
  existing_jobid bigint;
BEGIN
  SELECT jobid INTO existing_jobid FROM cron.job WHERE jobname = 'prune-itinerary-versions-daily';
  IF existing_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(existing_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'prune-itinerary-versions-daily',
  '0 3 * * *',
  $$SELECT public.prune_itinerary_versions_per_trip()$$
);