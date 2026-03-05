-- =====================================================
-- WHATSAPP BUSINESS API INTEGRATION - DATABASE SCHEMA
-- =====================================================

-- 1. WhatsApp Settings Table (singleton for global config)
CREATE TABLE public.whatsapp_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Exotel WhatsApp Credentials (can be null to use env vars)
  exotel_sid TEXT,
  exotel_api_key TEXT,
  exotel_api_token TEXT,
  exotel_subdomain TEXT DEFAULT 'api.exotel.com',
  
  -- WhatsApp Business Account
  whatsapp_source_number TEXT NOT NULL,
  waba_id TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Single row constraint (global settings)
CREATE UNIQUE INDEX whatsapp_settings_single ON public.whatsapp_settings ((true));

-- Enable RLS
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

-- Only admin users can manage settings (using user_roles table)
CREATE POLICY "Admin users can view whatsapp settings" 
  ON public.whatsapp_settings 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role::text IN ('platform_admin', 'super_admin', 'admin_tech', 'admin_administration', 'admin')
  ));

CREATE POLICY "Admin users can insert whatsapp settings" 
  ON public.whatsapp_settings 
  FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role::text IN ('platform_admin', 'super_admin', 'admin_tech', 'admin_administration', 'admin')
  ));

CREATE POLICY "Admin users can update whatsapp settings" 
  ON public.whatsapp_settings 
  FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role::text IN ('platform_admin', 'super_admin', 'admin_tech', 'admin_administration', 'admin')
  ));

CREATE POLICY "Admin users can delete whatsapp settings" 
  ON public.whatsapp_settings 
  FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role::text IN ('platform_admin', 'super_admin', 'admin_tech', 'admin_administration', 'admin')
  ));

-- 2. WhatsApp Messages Table
CREATE TABLE public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demandcom_id UUID REFERENCES public.demandcom(id) ON DELETE SET NULL,
  
  -- Message Details
  phone_number TEXT NOT NULL,
  message_content TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  
  -- Template Reference
  template_id UUID,
  template_name TEXT,
  template_variables JSONB,
  
  -- Status Tracking
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'sent', 'delivered', 'read', 'failed', 'received'
  )),
  exotel_message_id TEXT,
  error_message TEXT,
  
  -- Timestamps
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  
  -- Media Support
  media_url TEXT,
  media_type TEXT CHECK (media_type IS NULL OR media_type IN ('image', 'document', 'video', 'audio', 'sticker')),
  
  -- Audit
  sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_whatsapp_messages_demandcom ON public.whatsapp_messages(demandcom_id);
CREATE INDEX idx_whatsapp_messages_exotel_id ON public.whatsapp_messages(exotel_message_id);
CREATE INDEX idx_whatsapp_messages_phone ON public.whatsapp_messages(phone_number);
CREATE INDEX idx_whatsapp_messages_status ON public.whatsapp_messages(status);
CREATE INDEX idx_whatsapp_messages_sent_at ON public.whatsapp_messages(sent_at DESC);

-- Enable Realtime for live chat updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;

-- Enable RLS
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view and insert messages
CREATE POLICY "Authenticated users can view whatsapp messages" 
  ON public.whatsapp_messages 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert whatsapp messages" 
  ON public.whatsapp_messages 
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- Allow updates for status tracking (webhook updates need this)
CREATE POLICY "Allow updates for whatsapp messages" 
  ON public.whatsapp_messages 
  FOR UPDATE 
  USING (true);

-- 3. WhatsApp Templates Table
CREATE TABLE public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Template Identity
  template_id TEXT NOT NULL UNIQUE,
  template_name TEXT NOT NULL,
  
  -- Template Content
  category TEXT,
  language TEXT DEFAULT 'en',
  content TEXT NOT NULL,
  
  -- Header/Footer
  header_type TEXT,
  header_content TEXT,
  footer_text TEXT,
  
  -- Buttons & Variables
  buttons JSONB DEFAULT '[]'::jsonb,
  variables JSONB DEFAULT '[]'::jsonb,
  sample_values JSONB DEFAULT '{}'::jsonb,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('approved', 'pending', 'rejected')),
  rejection_reason TEXT,
  
  -- Timestamps
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view templates
CREATE POLICY "Authenticated users can view whatsapp templates" 
  ON public.whatsapp_templates 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Admins can manage templates
CREATE POLICY "Admin users can insert whatsapp templates" 
  ON public.whatsapp_templates 
  FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role::text IN ('platform_admin', 'super_admin', 'admin_tech', 'admin_administration', 'admin')
  ));

CREATE POLICY "Admin users can update whatsapp templates" 
  ON public.whatsapp_templates 
  FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role::text IN ('platform_admin', 'super_admin', 'admin_tech', 'admin_administration', 'admin')
  ));

CREATE POLICY "Admin users can delete whatsapp templates" 
  ON public.whatsapp_templates 
  FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role::text IN ('platform_admin', 'super_admin', 'admin_tech', 'admin_administration', 'admin')
  ));

-- Trigger for updated_at on whatsapp_settings
CREATE TRIGGER update_whatsapp_settings_updated_at
  BEFORE UPDATE ON public.whatsapp_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on whatsapp_templates
CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();