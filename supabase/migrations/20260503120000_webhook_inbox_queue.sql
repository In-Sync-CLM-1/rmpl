-- Webhook inbox queue: defers heavy webhook processing to business hours (9:30 AM – 8:00 PM IST)
-- Outside business hours, webhooks store the raw payload here and return 200 OK immediately.
-- A pg_cron job at 9:30 AM IST replays everything that accumulated overnight.

CREATE TABLE IF NOT EXISTS public.webhook_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_name text NOT NULL,
  method text NOT NULL DEFAULT 'POST',
  payload text,
  content_type text,
  headers jsonb DEFAULT '{}'::jsonb,
  query_params jsonb DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text,
  attempt_count integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_webhook_inbox_unprocessed
  ON public.webhook_inbox (received_at)
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_inbox_name_received
  ON public.webhook_inbox (webhook_name, received_at DESC);

ALTER TABLE public.webhook_inbox ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.webhook_inbox IS
  'Holds raw inbound webhook payloads that arrive outside business hours. Replayed by process-webhook-inbox at 9:30 AM IST.';

-- Schedule daily replay at 4:00 AM UTC = 9:30 AM IST
-- Same pattern as invoice-reminder-cron migration: hardcoded URL, function uses verify_jwt=false
SELECT cron.schedule(
  'webhook-inbox-flush',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ltlvhmwrrsromwuiybwu.supabase.co/functions/v1/process-webhook-inbox',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('trigger', 'scheduled', 'time', now())
  ) AS request_id;
  $$
);
