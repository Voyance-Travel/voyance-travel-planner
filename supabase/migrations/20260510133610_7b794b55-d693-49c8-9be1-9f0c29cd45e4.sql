ALTER TABLE public.trip_learnings
  ADD COLUMN IF NOT EXISTS summary_source TEXT DEFAULT 'ai';