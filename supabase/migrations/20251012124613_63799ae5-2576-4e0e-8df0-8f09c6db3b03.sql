-- Drop extensions from public schema if they were created there
DROP EXTENSION IF EXISTS pg_cron CASCADE;
DROP EXTENSION IF EXISTS pg_net CASCADE;

-- Create extensions in the proper extensions schema
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Recreate the scheduled cleanup job (previous one was dropped with CASCADE)
SELECT cron.schedule(
  'cleanup-old-import-files',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ltlvhmwrrsromwuiybwu.supabase.co/functions/v1/cleanup-old-import-files',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('time', now(), 'trigger', 'scheduled')
  ) as request_id;
  $$
);