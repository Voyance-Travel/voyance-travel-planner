
-- ============================================================
-- FIX 1: rate_limits — restrict ALL to service_role only
-- ============================================================
DROP POLICY IF EXISTS "Allow service role to manage rate limits" ON public.rate_limits;
CREATE POLICY "Service role can manage rate limits"
  ON public.rate_limits FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- FIX 2: trip_complexity — restrict ALL to service_role only
-- ============================================================
DROP POLICY IF EXISTS "Service role can manage trip complexity" ON public.trip_complexity;
CREATE POLICY "Service role manages trip complexity"
  ON public.trip_complexity FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- FIX 3: trip_cost_tracking INSERT — restrict to service_role
-- ============================================================
DROP POLICY IF EXISTS "Service role can insert cost tracking" ON public.trip_cost_tracking;
CREATE POLICY "Service role can insert cost tracking"
  ON public.trip_cost_tracking FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================
-- FIX 4: customer_reviews INSERT — require user_id = auth.uid()
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can submit reviews" ON public.customer_reviews;
CREATE POLICY "Authenticated users can submit own reviews"
  ON public.customer_reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
