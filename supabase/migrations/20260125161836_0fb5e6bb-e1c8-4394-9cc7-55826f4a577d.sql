-- Add external_id for mapping frontend-generated activity IDs to DB UUIDs
ALTER TABLE public.itinerary_activities
ADD COLUMN IF NOT EXISTS external_id text;

-- Ensure we can upsert activities by (trip_id, itinerary_day_id, external_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_itinerary_activities_external_id'
  ) THEN
    CREATE UNIQUE INDEX idx_itinerary_activities_external_id
      ON public.itinerary_activities (trip_id, itinerary_day_id, external_id)
      WHERE external_id IS NOT NULL;
  END IF;
END $$;

-- Helpful lookup index for locked activities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_itinerary_activities_locked'
  ) THEN
    CREATE INDEX idx_itinerary_activities_locked
      ON public.itinerary_activities (trip_id, itinerary_day_id, is_locked);
  END IF;
END $$;