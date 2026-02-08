
ALTER TABLE public.trip_suggestions
  ADD COLUMN IF NOT EXISTS vote_deadline TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.trip_suggestions.vote_deadline IS 'Optional deadline by which group members should vote on this suggestion';
