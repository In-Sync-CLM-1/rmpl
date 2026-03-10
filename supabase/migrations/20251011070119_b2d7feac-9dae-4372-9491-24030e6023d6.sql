-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily ExcelHire sync at 2 AM UTC
SELECT cron.schedule(
  'daily-excelhire-sync',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ltlvhmwrrsromwuiybwu.supabase.co/functions/v1/sync-excelhire-candidates',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('time', now())
  ) as request_id;
  $$
);