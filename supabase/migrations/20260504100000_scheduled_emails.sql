-- Scheduled emails for DemandCom "Send Later" feature.
-- Each row captures the full request payload (individual or bulk) plus a
-- send-at timestamp. A pg_cron worker dispatches due rows to the
-- process-scheduled-emails edge function, which reuses the same Resend
-- pipeline as send-bulk-email.

CREATE TABLE IF NOT EXISTS public.scheduled_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  mode text NOT NULL CHECK (mode IN ('individual', 'bulk')),
  demandcom_id uuid,
  filters jsonb,
  template_id uuid,
  subject text,
  body_html text,

  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),

  sent_count int NOT NULL DEFAULT 0,
  skipped_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  total_count int NOT NULL DEFAULT 0,
  error_message text,

  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_scheduled_emails_due
  ON public.scheduled_emails (scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scheduled_emails_created_by
  ON public.scheduled_emails (created_by, created_at DESC);

ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read scheduled emails" ON public.scheduled_emails;
CREATE POLICY "Authenticated users read scheduled emails"
  ON public.scheduled_emails FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users cancel own scheduled emails" ON public.scheduled_emails;
CREATE POLICY "Authenticated users cancel own scheduled emails"
  ON public.scheduled_emails FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND status = 'pending')
  WITH CHECK (created_by = auth.uid() AND status IN ('pending', 'cancelled'));

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.scheduled_emails_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scheduled_emails_touch ON public.scheduled_emails;
CREATE TRIGGER trg_scheduled_emails_touch
  BEFORE UPDATE ON public.scheduled_emails
  FOR EACH ROW EXECUTE FUNCTION public.scheduled_emails_touch_updated_at();

-- Cron: dispatch due scheduled emails every minute.
-- The processor function holds its own service-role key and authenticates
-- itself; the request body just carries a trigger marker.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-emails') THEN
    PERFORM cron.unschedule('process-scheduled-emails');
  END IF;
END $$;

SELECT cron.schedule(
  'process-scheduled-emails',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ltlvhmwrrsromwuiybwu.supabase.co/functions/v1/process-scheduled-emails',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('trigger', 'scheduled', 'time', now())
  ) AS request_id;
  $$
);
