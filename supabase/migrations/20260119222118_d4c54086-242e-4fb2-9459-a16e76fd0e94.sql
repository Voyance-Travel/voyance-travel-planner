-- Add service role policy to search_cache table
-- This allows edge functions (using service role key) to read/write cache entries

CREATE POLICY "Service role can manage search cache"
ON public.search_cache
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMENT ON POLICY "Service role can manage search cache" ON public.search_cache 
IS 'Allows edge functions with service role key to read/write search cache entries';