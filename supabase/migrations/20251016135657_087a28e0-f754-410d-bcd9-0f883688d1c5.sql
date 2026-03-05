-- Drop existing policies on user_import_jobs
DROP POLICY IF EXISTS "Admins can view all user import jobs" ON public.user_import_jobs;
DROP POLICY IF EXISTS "Admins can create user import jobs" ON public.user_import_jobs;
DROP POLICY IF EXISTS "Admins can update their import jobs" ON public.user_import_jobs;

-- Recreate policies with platform_admin included
CREATE POLICY "Admins can view all user import jobs" ON public.user_import_jobs
  FOR SELECT USING (
    has_role(auth.uid(), 'platform_admin'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'admin_administration'::app_role)
  );

CREATE POLICY "Admins can create user import jobs" ON public.user_import_jobs
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND (
      has_role(auth.uid(), 'platform_admin'::app_role) OR
      has_role(auth.uid(), 'admin'::app_role) OR 
      has_role(auth.uid(), 'super_admin'::app_role) OR
      has_role(auth.uid(), 'admin_administration'::app_role)
    )
  );

CREATE POLICY "Admins can update their import jobs" ON public.user_import_jobs
  FOR UPDATE USING (
    auth.uid() = user_id AND (
      has_role(auth.uid(), 'platform_admin'::app_role) OR
      has_role(auth.uid(), 'admin'::app_role) OR 
      has_role(auth.uid(), 'super_admin'::app_role) OR
      has_role(auth.uid(), 'admin_administration'::app_role)
    )
  );