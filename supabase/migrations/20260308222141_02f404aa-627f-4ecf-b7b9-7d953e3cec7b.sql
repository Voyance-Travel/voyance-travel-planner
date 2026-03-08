
CREATE TABLE IF NOT EXISTS public.route_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  origin_lat numeric(9,6) NOT NULL,
  origin_lng numeric(9,6) NOT NULL,
  dest_lat numeric(9,6) NOT NULL,
  dest_lng numeric(9,6) NOT NULL,
  travel_mode text NOT NULL DEFAULT 'TRANSIT',
  cache_key text GENERATED ALWAYS AS (
    round(origin_lat::numeric, 3)::text || ',' ||
    round(origin_lng::numeric, 3)::text || '→' ||
    round(dest_lat::numeric, 3)::text || ',' ||
    round(dest_lng::numeric, 3)::text || ':' ||
    travel_mode
  ) STORED,
  distance_meters integer,
  duration_text text,
  duration_seconds integer,
  steps_json jsonb,
  transit_details_json jsonb,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '14 days'),
  hit_count integer DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_route_cache_key ON public.route_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_route_cache_expires ON public.route_cache(expires_at);

ALTER TABLE public.route_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.route_cache
  FOR ALL USING (true) WITH CHECK (true);
