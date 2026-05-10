CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('auto-summarize-completed-trips')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-summarize-completed-trips');

SELECT cron.schedule(
  'auto-summarize-completed-trips',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jsxplunjjvxuejeouwob.supabase.co/functions/v1/summarize-trip-learnings-batch',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeHBsdW5qanZ4dWVqZW91d29iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NjY5NjcsImV4cCI6MjA4NDI0Mjk2N30.lSnd496usAKj7Cr3BUlF3WQkjTBGLc2ZRPWwvL7lvIs"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);