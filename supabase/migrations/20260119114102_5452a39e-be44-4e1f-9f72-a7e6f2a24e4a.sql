-- Remove the old cron job with hardcoded key
SELECT cron.unschedule('send-trip-reminders-daily');

-- Recreate cron job using service role key from environment
-- pg_cron runs as postgres superuser, so we use the service role key stored in Supabase vault
-- For security, we don't include auth header and instead rely on the edge function 
-- to validate requests from internal sources via the 'source' parameter

SELECT cron.schedule(
  'send-trip-reminders-daily',
  '0 8 * * *', -- 8 AM UTC every day
  $$
  SELECT net.http_post(
    url := current_setting('supabase.functions_url', true) || '/send-trip-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);