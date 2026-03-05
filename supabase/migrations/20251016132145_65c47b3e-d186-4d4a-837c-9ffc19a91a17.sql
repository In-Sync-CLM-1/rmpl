-- Create user_import_jobs table for tracking bulk user imports
CREATE TABLE public.user_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  current_stage TEXT DEFAULT 'pending',
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_details JSONB DEFAULT '[]'::jsonb,
  stage_details JSONB DEFAULT '{}'::jsonb,
  file_cleaned_up BOOLEAN DEFAULT false,
  file_cleanup_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_import_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all user import jobs" ON public.user_import_jobs
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'admin_administration'::app_role)
  );

CREATE POLICY "Admins can create user import jobs" ON public.user_import_jobs
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND (
      has_role(auth.uid(), 'admin'::app_role) OR 
      has_role(auth.uid(), 'super_admin'::app_role) OR
      has_role(auth.uid(), 'admin_administration'::app_role)
    )
  );

CREATE POLICY "Admins can update their import jobs" ON public.user_import_jobs
  FOR UPDATE USING (
    auth.uid() = user_id AND (
      has_role(auth.uid(), 'admin'::app_role) OR 
      has_role(auth.uid(), 'super_admin'::app_role) OR
      has_role(auth.uid(), 'admin_administration'::app_role)
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_import_jobs;

-- Trigger for updated_at
CREATE TRIGGER update_user_import_jobs_updated_at
  BEFORE UPDATE ON public.user_import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();