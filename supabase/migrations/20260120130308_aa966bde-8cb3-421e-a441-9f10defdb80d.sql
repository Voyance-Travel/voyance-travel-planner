-- Add booking_source to distinguish booking modes
-- Mode 1: native_api (Viator, future Amadeus booking)
-- Mode 2: imported (agent booked externally, imported confirmation)
-- Mode 3: client_booked (informational - client booked themselves or ticketed outside system)

CREATE TYPE booking_source AS ENUM ('native_api', 'imported', 'client_booked', 'manual');

ALTER TABLE public.agency_booking_segments 
ADD COLUMN IF NOT EXISTS booking_source booking_source DEFAULT 'manual';

-- Add informational fields for Mode 3 (client-booked/informational segments)
ALTER TABLE public.agency_booking_segments
ADD COLUMN IF NOT EXISTS baggage_allowance TEXT,
ADD COLUMN IF NOT EXISTS terminal_info JSONB,
ADD COLUMN IF NOT EXISTS timezone_info TEXT,
ADD COLUMN IF NOT EXISTS support_instructions TEXT,
ADD COLUMN IF NOT EXISTS is_informational_only BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.agency_booking_segments.booking_source IS 'How this booking was created: native_api (Viator etc), imported (agent booked elsewhere), client_booked (informational), manual';
COMMENT ON COLUMN public.agency_booking_segments.is_informational_only IS 'True for segments where agent is not managing the booking, just tracking for itinerary purposes';