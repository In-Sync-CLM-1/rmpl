-- Create custom_forms table
CREATE TABLE public.custom_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('active', 'draft', 'archived')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  submission_count INTEGER NOT NULL DEFAULT 0,
  target_table TEXT CHECK (target_table IN ('demandcom', 'master', 'clients')),
  field_mappings JSONB DEFAULT '{}'::jsonb,
  is_public BOOLEAN DEFAULT false,
  slug TEXT UNIQUE
);

-- Create form_submissions table
CREATE TABLE public.form_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES public.custom_forms(id) ON DELETE CASCADE,
  submitted_data JSONB NOT NULL,
  submitted_by UUID REFERENCES auth.users(id),
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  target_record_id UUID,
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.custom_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_forms
CREATE POLICY "Users can view their own forms"
  ON public.custom_forms FOR SELECT
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Users can create forms"
  ON public.custom_forms FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own forms"
  ON public.custom_forms FOR UPDATE
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Admins can delete forms"
  ON public.custom_forms FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Anyone can view public forms"
  ON public.custom_forms FOR SELECT
  USING (is_public = true AND status = 'active');

-- RLS Policies for form_submissions
CREATE POLICY "Form creators can view submissions"
  ON public.form_submissions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.custom_forms
    WHERE custom_forms.id = form_submissions.form_id
    AND (custom_forms.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'platform_admin'::app_role))
  ));

CREATE POLICY "Anyone can submit to public forms"
  ON public.form_submissions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.custom_forms
    WHERE custom_forms.id = form_submissions.form_id
    AND custom_forms.is_public = true
    AND custom_forms.status = 'active'
  ));

CREATE POLICY "Authenticated users can submit forms"
  ON public.form_submissions FOR INSERT
  WITH CHECK (auth.uid() = submitted_by OR submitted_by IS NULL);

CREATE POLICY "Form creators can update submissions"
  ON public.form_submissions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.custom_forms
    WHERE custom_forms.id = form_submissions.form_id
    AND (custom_forms.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'platform_admin'::app_role))
  ));

-- Create trigger to update updated_at
CREATE TRIGGER update_custom_forms_updated_at
  BEFORE UPDATE ON public.custom_forms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to generate unique slug
CREATE OR REPLACE FUNCTION generate_form_slug()
RETURNS TEXT AS $$
DECLARE
  new_slug TEXT;
  slug_exists BOOLEAN;
BEGIN
  LOOP
    new_slug := lower(substring(md5(random()::text) from 1 for 8));
    SELECT EXISTS(SELECT 1 FROM custom_forms WHERE slug = new_slug) INTO slug_exists;
    EXIT WHEN NOT slug_exists;
  END LOOP;
  RETURN new_slug;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate slug
CREATE OR REPLACE FUNCTION set_form_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := generate_form_slug();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_custom_forms_slug
  BEFORE INSERT ON public.custom_forms
  FOR EACH ROW
  EXECUTE FUNCTION set_form_slug();

-- Create indexes for performance
CREATE INDEX idx_custom_forms_created_by ON public.custom_forms(created_by);
CREATE INDEX idx_custom_forms_status ON public.custom_forms(status);
CREATE INDEX idx_custom_forms_slug ON public.custom_forms(slug);
CREATE INDEX idx_form_submissions_form_id ON public.form_submissions(form_id);
CREATE INDEX idx_form_submissions_status ON public.form_submissions(status);
CREATE INDEX idx_form_submissions_submitted_at ON public.form_submissions(submitted_at);