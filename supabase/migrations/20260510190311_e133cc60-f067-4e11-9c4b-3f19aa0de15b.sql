DROP POLICY IF EXISTS "Service role full access" ON public.route_cache;

ALTER TABLE public.route_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "route_cache_public_read"
  ON public.route_cache
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "route_cache_service_role_write"
  ON public.route_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE INSERT, UPDATE, DELETE ON public.route_cache FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.route_cache FROM authenticated;