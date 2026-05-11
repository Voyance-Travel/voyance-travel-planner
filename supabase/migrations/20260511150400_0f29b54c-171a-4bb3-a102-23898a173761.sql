DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'stripe_webhook_log',
    'chat_idempotency_cache',
    'destination_insights_cache',
    'google_places_search_cache',
    'travel_intel_locks'
  ] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', t);
  END LOOP;
END $$;

DO $$
DECLARE
  t text;
  pname text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'stripe_webhook_log',
    'chat_idempotency_cache',
    'destination_insights_cache',
    'google_places_search_cache',
    'travel_intel_locks'
  ] LOOP
    pname := t || '_deny_non_service';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pname, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I
         AS RESTRICTIVE
         FOR ALL
         TO anon, authenticated
         USING (false)
         WITH CHECK (false)',
      pname, t);
  END LOOP;
END $$;