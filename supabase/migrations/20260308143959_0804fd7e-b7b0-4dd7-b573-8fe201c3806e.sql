
-- Manual entries for community guides
CREATE TABLE public.guide_manual_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'activity',
  description TEXT,
  external_url TEXT,
  day_number INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.guide_manual_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own manual entries"
  ON public.guide_manual_entries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own manual entries"
  ON public.guide_manual_entries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own manual entries"
  ON public.guide_manual_entries FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own manual entries"
  ON public.guide_manual_entries FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
