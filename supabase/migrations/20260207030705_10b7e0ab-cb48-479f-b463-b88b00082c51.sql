
-- Trip reviews table for rich multi-dimension feedback on completed trips
CREATE TABLE public.trip_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  overall_rating SMALLINT NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  value_rating SMALLINT CHECK (value_rating >= 1 AND value_rating <= 5),
  experience_rating SMALLINT CHECK (experience_rating >= 1 AND experience_rating <= 5),
  location_rating SMALLINT CHECK (location_rating >= 1 AND location_rating <= 5),
  food_rating SMALLINT CHECK (food_rating >= 1 AND food_rating <= 5),
  highlight_label TEXT,
  highlight_text TEXT,
  review_text TEXT,
  photo_url TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, trip_id)
);

ALTER TABLE public.trip_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reviews" ON public.trip_reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reviews" ON public.trip_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON public.trip_reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reviews" ON public.trip_reviews FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_trip_reviews_updated_at
BEFORE UPDATE ON public.trip_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
