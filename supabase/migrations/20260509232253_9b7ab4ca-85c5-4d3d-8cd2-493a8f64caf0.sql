ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS itinerary_sync_status text NOT NULL DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS itinerary_synced_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trips_itinerary_sync_status_check'
  ) THEN
    ALTER TABLE public.trips
      ADD CONSTRAINT trips_itinerary_sync_status_check
      CHECK (itinerary_sync_status IN ('synced','pending','failed'));
  END IF;
END $$;