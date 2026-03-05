-- Fix hierarchical access control - prevent same-level users from accessing each other's data
-- CRITICAL SECURITY FIX: Change >= to > in designation level comparison
-- This ensures agents (same level) cannot see each other's data

-- HIERARCHICAL ACCESS CONTROL RULES:
-- 1. Users can access their own data (self-access)
-- 2. Users can access their direct reports' data
-- 3. Users can access indirect reports' data (recursive)
-- 4. Users with HIGHER designation level can access LOWER level data
--    Example: Manager (level 2) can access Agent (level 1) data
-- 5. Users at SAME designation level CANNOT access each other
--    Example: Agent A cannot access Agent B's data
-- 6. Admin roles bypass all restrictions
--
-- IMPORTANT: Designation level comparison uses STRICT GREATER THAN (>)
-- to prevent peer-to-peer data access while maintaining hierarchy

CREATE OR REPLACE FUNCTION public.can_access_user(_accessor_id uuid, _target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    -- FIXED: User can access those with LOWER designation level ONLY (changed from >= to >)
    -- This prevents agents from seeing other agents' data
    public.get_user_designation_level(_accessor_id) > public.get_user_designation_level(_target_id)
    OR
    -- All admin roles can access everyone
    public.has_role(_accessor_id, 'platform_admin'::app_role)
    OR
    public.has_role(_accessor_id, 'super_admin'::app_role)
    OR
    public.has_role(_accessor_id, 'admin'::app_role)
    OR
    public.has_role(_accessor_id, 'admin_administration'::app_role)
    OR
    public.has_role(_accessor_id, 'admin_tech'::app_role)
$function$;