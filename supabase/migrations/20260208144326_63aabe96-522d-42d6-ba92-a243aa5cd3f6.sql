
-- Add Smart Finish columns to trips table
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS smart_finish_purchased boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS smart_finish_purchased_at timestamptz,
ADD COLUMN IF NOT EXISTS gap_analysis_result jsonb;

-- Index for quick lookup of Smart Finish status
CREATE INDEX IF NOT EXISTS idx_trips_smart_finish ON public.trips (smart_finish_purchased) WHERE smart_finish_purchased = true;
