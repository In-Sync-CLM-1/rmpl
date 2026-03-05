-- Rename client_import_jobs table to master_import_jobs
ALTER TABLE public.client_import_jobs RENAME TO master_import_jobs;

-- Update RLS policies
DROP POLICY IF EXISTS "Managers can view all client import jobs" ON public.master_import_jobs;
DROP POLICY IF EXISTS "Users can create their own client import jobs" ON public.master_import_jobs;
DROP POLICY IF EXISTS "Users can update their own client import jobs" ON public.master_import_jobs;
DROP POLICY IF EXISTS "Users can view their own client import jobs" ON public.master_import_jobs;

CREATE POLICY "Managers can view all master import jobs"
  ON public.master_import_jobs
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'platform_admin'::app_role)
  );

CREATE POLICY "Users can create their own master import jobs"
  ON public.master_import_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own master import jobs"
  ON public.master_import_jobs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own master import jobs"
  ON public.master_import_jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);