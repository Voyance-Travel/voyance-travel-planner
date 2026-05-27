-- Canonical-Preference-Spine §7: read-only diagnostic view for trips that
-- carry Step-3 preferences in metadata but have zero active rows in
-- trip_day_intents. NEVER mutates — used by ops + the lazy heal-trip-
-- preferences edge fn (callable from owner visit).
CREATE OR REPLACE VIEW public.trips_with_orphan_preferences AS
SELECT
  t.id AS trip_id,
  t.user_id,
  t.destination,
  t.start_date,
  t.itinerary_status,
  (t.metadata->>'additionalNotes') AS additional_notes,
  jsonb_array_length(COALESCE(t.metadata->'mustDoActivities','[]'::jsonb)) AS must_do_count,
  jsonb_array_length(COALESCE(t.metadata->'perDayActivities','[]'::jsonb)) AS per_day_count,
  (
    SELECT COUNT(*) FROM public.trip_day_intents tdi
    WHERE tdi.trip_id = t.id AND tdi.status = 'active'
  ) AS active_intents_count,
  t.updated_at
FROM public.trips t
WHERE t.status != 'cancelled'
  AND (
    COALESCE(NULLIF(t.metadata->>'additionalNotes',''), '') <> ''
    OR jsonb_array_length(COALESCE(t.metadata->'mustDoActivities','[]'::jsonb)) > 0
    OR jsonb_array_length(COALESCE(t.metadata->'perDayActivities','[]'::jsonb)) > 0
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.trip_day_intents tdi
    WHERE tdi.trip_id = t.id AND tdi.status = 'active'
  );

-- Owner-only access via the underlying trips RLS (views inherit row-by-row).
GRANT SELECT ON public.trips_with_orphan_preferences TO authenticated;
GRANT SELECT ON public.trips_with_orphan_preferences TO service_role;