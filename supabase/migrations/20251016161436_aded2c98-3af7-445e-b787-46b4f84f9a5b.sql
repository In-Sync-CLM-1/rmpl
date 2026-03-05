-- Comprehensive RLS Policy Update to Include platform_admin
-- This migration updates all admin-level policies to include platform_admin role

-- ============================================
-- USER ROLES TABLE
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Recreate policies with platform_admin
CREATE POLICY "Super admins and platform admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- DESIGNATIONS TABLE
-- ============================================

DROP POLICY IF EXISTS "Admins can manage designations" ON public.designations;
DROP POLICY IF EXISTS "Authenticated users can view designations" ON public.designations;

CREATE POLICY "Admins can manage designations"
ON public.designations
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

CREATE POLICY "Authenticated users can view designations"
ON public.designations
FOR SELECT
TO authenticated
USING (true);

-- ============================================
-- USER DESIGNATIONS TABLE
-- ============================================

DROP POLICY IF EXISTS "Admins can manage user designations" ON public.user_designations;
DROP POLICY IF EXISTS "Users can view designations" ON public.user_designations;

CREATE POLICY "Admins can manage user designations"
ON public.user_designations
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

CREATE POLICY "Users can view designations"
ON public.user_designations
FOR SELECT
TO authenticated
USING (true);

-- ============================================
-- TEAMS TABLE
-- ============================================

DROP POLICY IF EXISTS "Admins can create teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can delete teams" ON public.teams;
DROP POLICY IF EXISTS "Team leads and admins can update their teams" ON public.teams;
DROP POLICY IF EXISTS "Authenticated users can view teams" ON public.teams;

CREATE POLICY "Admins can create teams"
ON public.teams
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

CREATE POLICY "Admins can delete teams"
ON public.teams
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

CREATE POLICY "Team leads and admins can update their teams"
ON public.teams
FOR UPDATE
TO authenticated
USING (
  team_lead_id = auth.uid() OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

CREATE POLICY "Authenticated users can view teams"
ON public.teams
FOR SELECT
TO authenticated
USING (true);

-- ============================================
-- EMAIL TEMPLATES TABLE
-- ============================================

DROP POLICY IF EXISTS "Admins can delete email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users can view templates based on hierarchy" ON public.email_templates;

CREATE POLICY "Admins can delete email templates"
ON public.email_templates
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

CREATE POLICY "Users can view templates based on hierarchy"
ON public.email_templates
FOR SELECT
TO authenticated
USING (
  can_access_user(auth.uid(), created_by) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

-- ============================================
-- JOBS TABLE
-- ============================================

DROP POLICY IF EXISTS "Managers can manage jobs" ON public.jobs;
DROP POLICY IF EXISTS "Authenticated users can view jobs" ON public.jobs;

CREATE POLICY "Managers can manage jobs"
ON public.jobs
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

CREATE POLICY "Authenticated users can view jobs"
ON public.jobs
FOR SELECT
TO authenticated
USING (true);

-- ============================================
-- CLIENTS TABLE
-- ============================================

DROP POLICY IF EXISTS "Managers can manage clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;

CREATE POLICY "Managers can manage clients"
ON public.clients
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

CREATE POLICY "Authenticated users can view clients"
ON public.clients
FOR SELECT
TO authenticated
USING (true);

-- ============================================
-- CAMPAIGNS TABLE
-- ============================================

DROP POLICY IF EXISTS "Users can delete their own campaigns or admins can delete any" ON public.campaigns;
DROP POLICY IF EXISTS "Users can view campaigns based on hierarchy" ON public.campaigns;

CREATE POLICY "Users can delete their own campaigns or admins can delete any"
ON public.campaigns
FOR DELETE
TO authenticated
USING (
  auth.uid() = created_by OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

CREATE POLICY "Users can view campaigns based on hierarchy"
ON public.campaigns
FOR SELECT
TO authenticated
USING (
  can_access_user(auth.uid(), created_by) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

-- ============================================
-- IMPORT JOBS TABLE
-- ============================================

DROP POLICY IF EXISTS "Admins can view all import jobs" ON public.import_jobs;

CREATE POLICY "Admins can view all import jobs"
ON public.import_jobs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

-- ============================================
-- USER IMPORT JOBS TABLE
-- ============================================

DROP POLICY IF EXISTS "Admins can view all user import jobs" ON public.user_import_jobs;
DROP POLICY IF EXISTS "Admins can create user import jobs" ON public.user_import_jobs;
DROP POLICY IF EXISTS "Admins can update their import jobs" ON public.user_import_jobs;

CREATE POLICY "Admins can view all user import jobs"
ON public.user_import_jobs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'platform_admin'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'admin_administration'::app_role)
);

CREATE POLICY "Admins can create user import jobs"
ON public.user_import_jobs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND (
    has_role(auth.uid(), 'platform_admin'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'admin_administration'::app_role)
  )
);

CREATE POLICY "Admins can update their import jobs"
ON public.user_import_jobs
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id AND (
    has_role(auth.uid(), 'platform_admin'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'admin_administration'::app_role)
  )
);

-- ============================================
-- JOB SEEKERS TABLE
-- ============================================

DROP POLICY IF EXISTS "Admins can delete candidates" ON public.job_seekers;

CREATE POLICY "Admins can delete candidates"
ON public.job_seekers
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

-- ============================================
-- WEBHOOK CONNECTORS TABLE
-- ============================================

DROP POLICY IF EXISTS "Users can delete their own webhook connectors or admins can del" ON public.webhook_connectors;

CREATE POLICY "Users can delete their own webhook connectors or admins can delete any"
ON public.webhook_connectors
FOR DELETE
TO authenticated
USING (
  auth.uid() = created_by OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

-- ============================================
-- PASSWORD RESET LOGS TABLE
-- ============================================

DROP POLICY IF EXISTS "Admins can view password reset logs" ON public.password_reset_logs;

CREATE POLICY "Admins can view password reset logs"
ON public.password_reset_logs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

-- ============================================
-- SMS TEMPLATES TABLE
-- ============================================

DROP POLICY IF EXISTS "Admins can delete sms templates" ON public.sms_templates;

CREATE POLICY "Admins can delete sms templates"
ON public.sms_templates
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

-- ============================================
-- PIPELINE STAGES TABLE
-- ============================================

DROP POLICY IF EXISTS "Admins can manage pipeline stages" ON public.pipeline_stages;

CREATE POLICY "Admins can manage pipeline stages"
ON public.pipeline_stages
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

-- ============================================
-- JOB SEEKER RECOMMENDATIONS TABLE
-- ============================================

DROP POLICY IF EXISTS "Admins can delete recommendations" ON public.job_seeker_recommendations;
DROP POLICY IF EXISTS "Users can create recommendations for their candidates" ON public.job_seeker_recommendations;
DROP POLICY IF EXISTS "Users can update recommendations for their candidates" ON public.job_seeker_recommendations;
DROP POLICY IF EXISTS "Users can view recommendations for their candidates" ON public.job_seeker_recommendations;

CREATE POLICY "Admins can delete recommendations"
ON public.job_seeker_recommendations
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

CREATE POLICY "Users can create recommendations for their candidates"
ON public.job_seeker_recommendations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM job_seekers
    WHERE job_seekers.id = job_seeker_recommendations.job_seeker_id
      AND job_seekers.created_by = auth.uid()
  ) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

CREATE POLICY "Users can update recommendations for their candidates"
ON public.job_seeker_recommendations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM job_seekers
    WHERE job_seekers.id = job_seeker_recommendations.job_seeker_id
      AND job_seekers.created_by = auth.uid()
  ) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

CREATE POLICY "Users can view recommendations for their candidates"
ON public.job_seeker_recommendations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM job_seekers
    WHERE job_seekers.id = job_seeker_recommendations.job_seeker_id
      AND job_seekers.created_by = auth.uid()
  ) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

-- ============================================
-- JOB SEEKER ENGAGEMENT SUMMARY TABLE
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can manage engagement summaries" ON public.job_seeker_engagement_summary;
DROP POLICY IF EXISTS "Users can view engagement summaries for their candidates" ON public.job_seeker_engagement_summary;

CREATE POLICY "Authenticated users can manage engagement summaries"
ON public.job_seeker_engagement_summary
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM job_seekers
    WHERE job_seekers.id = job_seeker_engagement_summary.job_seeker_id
      AND job_seekers.created_by = auth.uid()
  ) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

CREATE POLICY "Users can view engagement summaries for their candidates"
ON public.job_seeker_engagement_summary
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM job_seekers
    WHERE job_seekers.id = job_seeker_engagement_summary.job_seeker_id
      AND job_seekers.created_by = auth.uid()
  ) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);