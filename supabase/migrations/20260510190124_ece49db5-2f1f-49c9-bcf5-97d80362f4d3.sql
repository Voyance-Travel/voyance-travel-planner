DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'chat_idempotency_cache',
    'destination_insights_cache',
    'google_places_search_cache',
    'stripe_webhook_log',
    'travel_intel_locks'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY "Service role full access" ON public.%I
         FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;