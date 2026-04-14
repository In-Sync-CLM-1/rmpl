-- Schedule daily invoice reminder cron job at 9:00 AM IST (03:30 UTC)
-- Sends reminders at 7, 10, and 13 days after event date if no invoice raised
SELECT cron.schedule(
  'invoice-reminder-daily',
  '30 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ltlvhmwrrsromwuiybwu.supabase.co/functions/v1/invoice-reminder-cron',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('trigger', 'scheduled', 'time', now())
  ) AS request_id;
  $$
);
