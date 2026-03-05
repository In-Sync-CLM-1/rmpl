
-- Table: user_oauth_tokens
CREATE TABLE public.user_oauth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'microsoft',
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type TEXT DEFAULT 'Bearer',
  scope TEXT,
  expires_at TIMESTAMPTZ,
  microsoft_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE public.user_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tokens"
  ON public.user_oauth_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens"
  ON public.user_oauth_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens"
  ON public.user_oauth_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens"
  ON public.user_oauth_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Service role needs full access for edge functions
CREATE POLICY "Service role full access on oauth tokens"
  ON public.user_oauth_tokens FOR ALL
  USING (true)
  WITH CHECK (true);

-- Table: email_activity_log
CREATE TABLE public.email_activity_log (
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

-- Service role full access for edge functions
CREATE POLICY "Service role full access on email log"
  ON public.email_activity_log FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at on user_oauth_tokens
CREATE TRIGGER update_user_oauth_tokens_updated_at
  BEFORE UPDATE ON public.user_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
