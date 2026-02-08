
-- Add creation_source to trips table for cost/margin tracking
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS creation_source text DEFAULT 'single_city';

-- Add comment for documentation
COMMENT ON COLUMN public.trips.creation_source IS 'How the trip was created: single_city, multi_city, chat, manual_paste';

-- Create index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_trips_creation_source ON public.trips(creation_source);
