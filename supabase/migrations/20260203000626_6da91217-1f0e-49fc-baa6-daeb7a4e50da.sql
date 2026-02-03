-- These tables are accessed only by edge functions with service role key
-- Enable RLS but with no policies = complete lockdown from client
-- Edge functions use service role which bypasses RLS

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destination_fallbacks ENABLE ROW LEVEL SECURITY;

-- Allow public read access to destination_fallbacks (it's static content)
CREATE POLICY "Anyone can read destination fallbacks"
  ON public.destination_fallbacks
  FOR SELECT
  USING (true);