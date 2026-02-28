-- Add blended_dna JSONB column to trips table for storing DNA blend snapshots
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS blended_dna jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.trips.blended_dna IS 'Snapshot of blended Travel DNA when trip has multiple travelers with include_preferences enabled. Contains blendedTraits, travelers array, blendMethod, and generatedAt timestamp.';