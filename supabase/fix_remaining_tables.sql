-- ============================================================
-- Fix remaining missing tables after migration run
-- Order: call_logs, demandcom_field_changes, whatsapp_messages,
--        email_activity_log, vapi_call_logs
-- ============================================================

-- ============================================================
-- 1. call_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid text UNIQUE NOT NULL,
  demandcom_id uuid REFERENCES public.demandcom(id) ON DELETE CASCADE,
  initiated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  from_number text NOT NULL,
  to_number text NOT NULL,
  status text NOT NULL DEFAULT 'initiated',
  direction text DEFAULT 'outbound-api',
  conversation_duration integer DEFAULT 0,
  recording_url text,
  start_time timestamptz,
  end_time timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  exotel_response jsonb DEFAULT '{}'::jsonb,
  disposition text,
  subdisposition text,
  notes text,
  disposition_set_by uuid REFERENCES public.profiles(id),
  disposition_set_at timestamptz,
  call_method TEXT DEFAULT 'phone' CHECK (call_method IN ('phone', 'screen')),
  edited_contact_info JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT call_logs_status_check CHECK (status IN (
    'initiated', 'ringing', 'in-progress', 'completed',
    'no-answer', 'busy', 'failed', 'canceled'
  ))
);

ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view call logs"
  ON public.call_logs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert call logs"
  ON public.call_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update call logs"
  ON public.call_logs FOR UPDATE TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_call_logs_demandcom_id ON public.call_logs(demandcom_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_initiated_by ON public.call_logs(initiated_by);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON public.call_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_status ON public.call_logs(status);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_sid ON public.call_logs(call_sid);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_method ON public.call_logs(call_method);
CREATE INDEX IF NOT EXISTS idx_call_logs_demandcom_id_method ON public.call_logs(demandcom_id, call_method);
CREATE INDEX IF NOT EXISTS idx_call_logs_demandcom_date ON public.call_logs(demandcom_id, disposition_set_at DESC);

CREATE TRIGGER update_call_logs_updated_at
  BEFORE UPDATE ON public.call_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. demandcom_field_changes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.demandcom_field_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demandcom_id UUID NOT NULL REFERENCES public.demandcom(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES public.profiles(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.demandcom_field_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view field changes"
  ON public.demandcom_field_changes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_demandcom_field_changes_demandcom_id ON public.demandcom_field_changes(demandcom_id);
CREATE INDEX IF NOT EXISTS idx_demandcom_field_changes_changed_by ON public.demandcom_field_changes(changed_by);
CREATE INDEX IF NOT EXISTS idx_demandcom_field_changes_changed_at ON public.demandcom_field_changes(changed_at);

-- ============================================================
-- 3. whatsapp_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demandcom_id UUID REFERENCES public.demandcom(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  message_content TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  template_id UUID,
  template_name TEXT,
  template_variables JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'sent', 'delivered', 'read', 'failed', 'received'
  )),
  exotel_message_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  media_url TEXT,
  media_type TEXT CHECK (media_type IS NULL OR media_type IN ('image', 'document', 'video', 'audio', 'sticker')),
  sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view whatsapp messages"
  ON public.whatsapp_messages FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert whatsapp messages"
  ON public.whatsapp_messages FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow updates for whatsapp messages"
  ON public.whatsapp_messages FOR UPDATE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_demandcom ON public.whatsapp_messages(demandcom_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_exotel_id ON public.whatsapp_messages(exotel_message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone ON public.whatsapp_messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON public.whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sent_at ON public.whatsapp_messages(sent_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;

-- ============================================================
-- 4. email_activity_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sent_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'microsoft',
  from_email TEXT,
  to_email TEXT NOT NULL,
  cc_emails TEXT[],
  bcc_emails TEXT[],
  subject TEXT,
  demandcom_id UUID REFERENCES public.demandcom(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  microsoft_message_id TEXT,
  has_attachments BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email logs"
  ON public.email_activity_log FOR SELECT
  USING (auth.uid() = sent_by);

CREATE POLICY "Users can insert their own email logs"
  ON public.email_activity_log FOR INSERT
  WITH CHECK (auth.uid() = sent_by);

CREATE POLICY "Service role full access on email log"
  ON public.email_activity_log FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 5. vapi_call_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vapi_call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demandcom_id UUID REFERENCES public.demandcom(id) ON DELETE SET NULL,
  vapi_call_id TEXT,
  assistant_id TEXT,
  phone_number TEXT,
  contact_name TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  duration_seconds INTEGER,
  transcript TEXT,
  call_summary TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  error_message TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sentiment TEXT,
  sentiment_score NUMERIC,
  response_summary TEXT,
  key_topics TEXT[],
  scheduled_call_id UUID REFERENCES public.vapi_scheduled_calls(id)
);

ALTER TABLE public.vapi_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view vapi call logs"
  ON public.vapi_call_logs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert vapi call logs"
  ON public.vapi_call_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update vapi call logs"
  ON public.vapi_call_logs FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_vapi_call_logs_demandcom ON public.vapi_call_logs(demandcom_id);
CREATE INDEX IF NOT EXISTS idx_vapi_call_logs_status ON public.vapi_call_logs(status);
CREATE INDEX IF NOT EXISTS idx_vapi_call_logs_created_at ON public.vapi_call_logs(created_at DESC);
