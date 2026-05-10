DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-search-cache') THEN
    PERFORM cron.schedule(
      'cleanup-search-cache',
      '0 4 * * *',
      $cmd$DELETE FROM public.search_cache WHERE expires_at < now()$cmd$
    );
  END IF;
END$$;