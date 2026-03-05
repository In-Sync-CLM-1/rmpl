-- Create client_import_jobs table for tracking bulk uploads
CREATE TABLE IF NOT EXISTS public.client_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  file_name text NOT NULL,
  file_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  current_stage text DEFAULT 'pending',
  total_rows integer DEFAULT 0,
  processed_rows integer DEFAULT 0,
  success_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  error_details jsonb DEFAULT '[]'::jsonb,
  stage_details jsonb DEFAULT '{}'::jsonb,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  file_cleaned_up boolean DEFAULT false,
  file_cleanup_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX idx_client_import_jobs_user_id ON public.client_import_jobs(user_id);
CREATE INDEX idx_client_import_jobs_status ON public.client_import_jobs(status);
CREATE INDEX idx_client_import_jobs_created_at ON public.client_import_jobs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.client_import_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own import jobs
CREATE POLICY "Users can view their own client import jobs"
  ON public.client_import_jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policy: Users can create their own import jobs
CREATE POLICY "Users can create their own client import jobs"
  ON public.client_import_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own import jobs
CREATE POLICY "Users can update their own client import jobs"
  ON public.client_import_jobs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policy: Managers/admins can view all import jobs
CREATE POLICY "Managers can view all client import jobs"
  ON public.client_import_jobs
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'platform_admin'::app_role)
  );

-- Add update trigger for updated_at column
CREATE TRIGGER update_client_import_jobs_updated_at
  BEFORE UPDATE ON public.client_import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Realtime for live progress updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_import_jobs;