CREATE TABLE public.trip_date_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  start_date text NOT NULL,
  end_date text NOT NULL,
  day_count integer NOT NULL,
  itinerary_data jsonb,
  hotel_selection jsonb,
  created_at timestamptz DEFAULT now(),
  created_by_action text DEFAULT 'date_change'
);

ALTER TABLE public.trip_date_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own trip date versions"
  ON public.trip_date_versions FOR ALL TO authenticated
  USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

CREATE INDEX idx_trip_date_versions_trip ON public.trip_date_versions(trip_id, created_at DESC);