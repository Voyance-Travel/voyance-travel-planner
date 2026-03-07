
-- Cached landmark suggestions per city (AI-generated, reusable)
CREATE TABLE public.city_landmarks_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  country text,
  landmarks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  UNIQUE(city)
);

-- No RLS needed — this is public reference data
ALTER TABLE public.city_landmarks_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read landmarks cache"
  ON public.city_landmarks_cache FOR SELECT
  TO anon, authenticated
  USING (true);

-- Index for fast lookups
CREATE INDEX idx_city_landmarks_cache_city ON public.city_landmarks_cache(lower(city));
