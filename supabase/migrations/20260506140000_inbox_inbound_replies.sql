-- Inbox feature — store incoming email replies and track WhatsApp read state.

-- ────────────────────────────────────────────────────────────────────────────
-- email_inbox: incoming replies received via Cloudflare Email Worker → webhook
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_inbox (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  from_address            TEXT NOT NULL,
  from_name               TEXT,
  to_address              TEXT NOT NULL,
  subject                 TEXT,
  body_text               TEXT,
  body_html               TEXT,
  message_id              TEXT,                                          -- RFC Message-ID
  in_reply_to             TEXT,                                          -- RFC In-Reply-To header
  rfc_references          TEXT[] DEFAULT ARRAY[]::TEXT[],                -- RFC References header parsed
  thread_token            TEXT,                                          -- extracted from reply+<token>@reply...
  email_activity_log_id   UUID REFERENCES public.email_activity_log(id) ON DELETE SET NULL,
  demandcom_id            UUID REFERENCES public.demandcom(id) ON DELETE SET NULL,
  is_read                 BOOLEAN NOT NULL DEFAULT false,
  raw_payload             JSONB,
  attachments             JSONB DEFAULT '[]'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_inbox_activity_log ON public.email_inbox(email_activity_log_id);
CREATE INDEX IF NOT EXISTS idx_email_inbox_demandcom   ON public.email_inbox(demandcom_id);
CREATE INDEX IF NOT EXISTS idx_email_inbox_received_at ON public.email_inbox(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_inbox_unread      ON public.email_inbox(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_email_inbox_from        ON public.email_inbox(from_address);

ALTER TABLE public.email_inbox ENABLE ROW LEVEL SECURITY;

-- Admins / managers see all replies; senders can see replies to their own outbound.
CREATE POLICY "Admins can view all email replies" ON public.email_inbox FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('platform_admin', 'super_admin', 'admin', 'admin_administration', 'admin_tech')
  )
);

CREATE POLICY "Senders can view replies to their emails" ON public.email_inbox FOR SELECT
USING (
  email_activity_log_id IN (
    SELECT id FROM public.email_activity_log WHERE sent_by = auth.uid()
  )
);

-- Updates: mark-as-read for users who can SELECT the row.
CREATE POLICY "Admins can update email replies" ON public.email_inbox FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('platform_admin', 'super_admin', 'admin', 'admin_administration', 'admin_tech')
  )
);

CREATE POLICY "Senders can update replies to their emails" ON public.email_inbox FOR UPDATE
USING (
  email_activity_log_id IN (
    SELECT id FROM public.email_activity_log WHERE sent_by = auth.uid()
  )
);

-- Inserts only via service-role (webhook). No public INSERT policy needed.

-- ────────────────────────────────────────────────────────────────────────────
-- whatsapp_messages: add is_read for the inbox UI
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_dc_dir_created
  ON public.whatsapp_messages(demandcom_id, direction, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone_created
  ON public.whatsapp_messages(phone_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_inbound_unread
  ON public.whatsapp_messages(is_read) WHERE direction = 'inbound' AND is_read = false;

-- Make existing inbound messages "read" so the UI doesn't show a huge backlog.
UPDATE public.whatsapp_messages SET is_read = true WHERE direction = 'inbound' AND is_read = false;
