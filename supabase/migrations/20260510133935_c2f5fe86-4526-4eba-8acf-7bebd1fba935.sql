CREATE TABLE IF NOT EXISTS public.trait_drift_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  sample_size int NOT NULL,
  deltas jsonb NOT NULL,
  before_scores jsonb,
  after_scores jsonb
);

ALTER TABLE public.trait_drift_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own drift log"
  ON public.trait_drift_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_trait_drift_log_user_ran
  ON public.trait_drift_log(user_id, ran_at DESC);