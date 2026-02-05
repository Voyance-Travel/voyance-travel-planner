-- Remove old permissive customer_reviews INSERT policy if it still exists
DROP POLICY IF EXISTS "Anyone can submit a review" ON public.customer_reviews;

-- The linter also flags these as warnings, but they're intentional:
-- rate_limits: Service role needs full access for edge functions
-- search_cache: Service role needs full access for caching
-- trip_cost_tracking: Service role INSERT for tracking

-- Add comment to document intentional policies
COMMENT ON TABLE public.rate_limits IS 'Rate limiting table with intentionally permissive service role policies to support edge function rate limiting for anonymous users';
COMMENT ON TABLE public.search_cache IS 'Search caching table with service role access for edge function caching';