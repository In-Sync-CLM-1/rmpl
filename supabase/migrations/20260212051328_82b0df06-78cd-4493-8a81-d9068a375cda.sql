
-- Onboarding forms (HR-managed)
CREATE TABLE public.onboarding_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR managers can manage onboarding forms"
  ON public.onboarding_forms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('hr_manager', 'platform_admin', 'super_admin', 'admin_tech')
    )
  );

CREATE POLICY "Anyone can read active onboarding forms"
  ON public.onboarding_forms FOR SELECT
  USING (is_active = true);

-- Onboarding submissions
CREATE TABLE public.onboarding_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES public.onboarding_forms(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  gender TEXT,
  date_of_birth DATE,
  marital_status TEXT,
  contact_number TEXT NOT NULL,
  qualifications TEXT,
  pan_number TEXT,
  aadhar_number TEXT,
  father_name TEXT,
  mother_name TEXT,
  emergency_contact_number TEXT,
  personal_email TEXT NOT NULL,
  present_address TEXT,
  permanent_address TEXT,
  uan_number TEXT,
  blood_group TEXT,
  bank_name TEXT,
  account_number TEXT,
  ifsc_code TEXT,
  branch_name TEXT,
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending',
  ai_review_result JSONB,
  ai_review_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit onboarding forms"
  ON public.onboarding_submissions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "HR managers can view submissions"
  ON public.onboarding_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('hr_manager', 'platform_admin', 'super_admin', 'admin_tech')
    )
  );

CREATE POLICY "HR managers can update submissions"
  ON public.onboarding_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('hr_manager', 'platform_admin', 'super_admin', 'admin_tech')
    )
  );

-- Onboarding documents
CREATE TABLE public.onboarding_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.onboarding_submissions(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  ai_analysis JSONB,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert onboarding documents"
  ON public.onboarding_documents FOR INSERT
  WITH CHECK (true);

CREATE POLICY "HR managers can view onboarding documents"
  ON public.onboarding_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('hr_manager', 'platform_admin', 'super_admin', 'admin_tech')
    )
  );

CREATE POLICY "HR managers can update onboarding documents"
  ON public.onboarding_documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('hr_manager', 'platform_admin', 'super_admin', 'admin_tech')
    )
  );

-- OTP verifications
CREATE TABLE public.onboarding_otp_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  type TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_otp_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert OTP verifications"
  ON public.onboarding_otp_verifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read OTP verifications"
  ON public.onboarding_otp_verifications FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update OTP verifications"
  ON public.onboarding_otp_verifications FOR UPDATE
  USING (true);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('onboarding-documents', 'onboarding-documents', false);

CREATE POLICY "Anyone can upload onboarding documents storage"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'onboarding-documents');

CREATE POLICY "HR can view onboarding documents storage"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'onboarding-documents');

-- Timestamp triggers
CREATE TRIGGER update_onboarding_forms_updated_at
  BEFORE UPDATE ON public.onboarding_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_onboarding_submissions_updated_at
  BEFORE UPDATE ON public.onboarding_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_onboarding_documents_updated_at
  BEFORE UPDATE ON public.onboarding_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
