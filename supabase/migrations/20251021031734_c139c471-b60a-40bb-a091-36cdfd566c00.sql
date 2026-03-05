-- Fix can_access_user to include reporting hierarchy
-- This allows users to see profiles of people who report to them, regardless of designation level

CREATE OR REPLACE FUNCTION public.can_access_user(_accessor_id uuid, _target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- User can access themselves
    _accessor_id = _target_id
    OR
    -- User can access direct reports (people who report to them)
    EXISTS (
      SELECT 1 
      FROM public.profiles 
      WHERE id = _target_id 
      AND reports_to = _accessor_id
    )
    OR
    -- User can access indirect reports (reports of reports, recursively)
    EXISTS (
      WITH RECURSIVE reporting_chain AS (
        -- Start with direct reports
        SELECT id, reports_to
        FROM public.profiles
        WHERE reports_to = _accessor_id
        
        UNION ALL
        
        -- Recursively get reports of reports
        SELECT p.id, p.reports_to
        FROM public.profiles p
        INNER JOIN reporting_chain rc ON p.reports_to = rc.id
      )
      SELECT 1
      FROM reporting_chain
      WHERE id = _target_id
    )
    OR
    -- User can access those with lower or equal designation level
    public.get_user_designation_level(_accessor_id) >= public.get_user_designation_level(_target_id)
    OR
    -- Admins and super_admins can access everyone
    public.has_role(_accessor_id, 'admin'::app_role)
    OR
    public.has_role(_accessor_id, 'super_admin'::app_role)
    OR
    public.has_role(_accessor_id, 'platform_admin'::app_role)
$$;