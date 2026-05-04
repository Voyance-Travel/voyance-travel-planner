
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS last_cost_repair_at timestamptz;

CREATE TABLE IF NOT EXISTS public.cost_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  activity_id text NOT NULL,
  previous_cents integer NOT NULL,
  new_cents integer NOT NULL,
  reason text NOT NULL,
  activity_title text,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cost_change_log_trip_applied
  ON public.cost_change_log (trip_id, applied_at DESC);

ALTER TABLE public.cost_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip owners and collaborators can view cost changes"
  ON public.cost_change_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = cost_change_log.trip_id
        AND (
          t.user_id = auth.uid()
          OR public.is_trip_collaborator(t.id, auth.uid(), false)
        )
    )
  );

CREATE POLICY "System inserts cost changes"
  ON public.cost_change_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = cost_change_log.trip_id
        AND (
          t.user_id = auth.uid()
          OR public.is_trip_collaborator(t.id, auth.uid(), true)
        )
    )
  );
