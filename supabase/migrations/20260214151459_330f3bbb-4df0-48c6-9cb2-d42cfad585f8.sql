
-- Add first_trip_used flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_trip_used boolean NOT NULL DEFAULT false;

-- Comment for clarity
COMMENT ON COLUMN public.profiles.first_trip_used IS 'Set to true only after first trip generation completes successfully. Prevents crashed trips from consuming the first-trip free benefit.';
