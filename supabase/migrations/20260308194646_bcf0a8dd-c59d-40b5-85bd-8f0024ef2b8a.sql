
-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule subscription-reminders to run daily at 8:00 AM UTC
SELECT cron.schedule(
  'subscription-reminders-daily',
  '0 8 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://xngppwphedaexwkgfjdv.supabase.co/functions/v1/subscription-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuZ3Bwd3BoZWRhZXh3a2dmamR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NjI5NTYsImV4cCI6MjA3NDQzODk1Nn0.0s_-NT6KhQFVJkHY5-Glr3WqMD4-_k3xFgBjHqEoffk"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);
