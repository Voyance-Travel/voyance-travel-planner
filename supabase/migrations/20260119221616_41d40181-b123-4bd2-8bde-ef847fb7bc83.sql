-- Add abandoned_at timestamp to track stale/abandoned trips
-- This is additive only - no existing data or functionality is affected

ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS abandoned_at TIMESTAMPTZ;

-- Add index for efficient querying of abandoned trips
CREATE INDEX IF NOT EXISTS idx_trips_abandoned_at 
ON public.trips(abandoned_at) 
WHERE abandoned_at IS NOT NULL;

-- Add last_activity_at to track user engagement with the trip
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT now();

-- Index for finding stale drafts (drafts with no recent activity)
CREATE INDEX IF NOT EXISTS idx_trips_stale_drafts 
ON public.trips(status, last_activity_at) 
WHERE status = 'draft';

COMMENT ON COLUMN public.trips.abandoned_at IS 'Timestamp when trip was marked as abandoned (null = not abandoned)';
COMMENT ON COLUMN public.trips.last_activity_at IS 'Last user interaction with this trip, used to detect stale drafts';