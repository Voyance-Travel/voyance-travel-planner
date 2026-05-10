ALTER TABLE public.travel_dna_profiles
  ADD COLUMN IF NOT EXISTS disambiguation_resolved_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS disambiguation_question_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS disambiguation_answer_id TEXT DEFAULT NULL;

COMMENT ON COLUMN public.travel_dna_profiles.disambiguation_resolved_at IS 'Timestamp when user resolved the DNA disambiguation question. NULL = not yet resolved or not needed.';