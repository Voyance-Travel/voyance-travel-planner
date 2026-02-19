
CREATE TABLE public.trip_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trip_id UUID NOT NULL,
  rating SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, trip_id)
);

CREATE INDEX idx_trip_ratings_user_trip ON public.trip_ratings (user_id, trip_id);

ALTER TABLE public.trip_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trip ratings"
  ON public.trip_ratings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trip ratings"
  ON public.trip_ratings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trip ratings"
  ON public.trip_ratings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_trip_ratings_updated_at
  BEFORE UPDATE ON public.trip_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
