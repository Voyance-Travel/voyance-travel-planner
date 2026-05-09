CREATE TABLE IF NOT EXISTS public.google_places_search_cache (
  cache_key text PRIMARY KEY,
  text_query text NOT NULL,
  location_bias jsonb,
  included_type text,
  field_mask text NOT NULL,
  response_data jsonb NOT NULL,
  result_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  hit_count integer NOT NULL DEFAULT 0,
  last_hit_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_places_cache_expires ON public.google_places_search_cache (expires_at);
CREATE INDEX IF NOT EXISTS idx_places_cache_text_query ON public.google_places_search_cache (text_query);

ALTER TABLE public.google_places_search_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_places_search_cache FROM PUBLIC;
REVOKE ALL ON public.google_places_search_cache FROM anon;
REVOKE ALL ON public.google_places_search_cache FROM authenticated;
GRANT ALL ON public.google_places_search_cache TO service_role;

CREATE OR REPLACE FUNCTION public.bump_places_cache_hit(p_cache_key text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.google_places_search_cache
  SET hit_count = hit_count + 1, last_hit_at = now()
  WHERE cache_key = p_cache_key;
$$;
REVOKE ALL ON FUNCTION public.bump_places_cache_hit(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_places_cache_hit(text) TO service_role;