-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create cron job to send trip reminders daily at 8 AM UTC
SELECT cron.schedule(
  'send-trip-reminders-daily',
  '0 8 * * *', -- 8 AM UTC every day
  $$
  SELECT net.http_post(
    url := 'https://jsxplunjjvxuejeouwob.supabase.co/functions/v1/send-trip-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeHBsdW5qanZ4dWVqZW91d29iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NjY5NjcsImV4cCI6MjA4NDI0Mjk2N30.lSnd496usAKj7Cr3BUlF3WQkjTBGLc2ZRPWwvL7lvIs"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);