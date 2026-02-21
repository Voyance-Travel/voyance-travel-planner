-- Add DNA snapshot columns to trips and itinerary_versions
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS dna_snapshot jsonb;

COMMENT ON COLUMN public.trips.dna_snapshot IS 'Snapshot of user Travel DNA profile at last generation time';

ALTER TABLE public.itinerary_versions
ADD COLUMN IF NOT EXISTS dna_snapshot jsonb;

COMMENT ON COLUMN public.itinerary_versions.dna_snapshot IS 'Snapshot of user Travel DNA profile used for this specific generation';