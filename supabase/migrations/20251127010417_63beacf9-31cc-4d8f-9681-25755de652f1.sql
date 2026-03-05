-- 1. Create is_admin_user helper function for consistent admin role checks
CREATE OR REPLACE FUNCTION public.is_admin_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('platform_admin', 'super_admin', 'admin', 'admin_administration', 'admin_tech')
  )
$$;

-- 2. Fix Projects Table RLS - Allow ALL authenticated users to view all projects
DROP POLICY IF EXISTS "Users can view projects based on hierarchy" ON projects;
DROP POLICY IF EXISTS "Project creators and admins can view projects" ON projects;

CREATE POLICY "All authenticated users can view projects"
ON projects FOR SELECT TO authenticated
USING (true);

-- 3. Fix DemandCom Table RLS - Proper hierarchy enforcement
DROP POLICY IF EXISTS "Users can view demandcom records - optimized" ON demandcom;
DROP POLICY IF EXISTS "Users can view demandcom records" ON demandcom;

CREATE POLICY "Users can view demandcom records with proper hierarchy"
ON demandcom FOR SELECT TO authenticated
USING (
  -- User's own assigned data
  assigned_to = auth.uid()
  OR
  -- Data user created
  created_by = auth.uid()
  OR
  -- All admin roles can see everything
  is_admin_user(auth.uid())
  OR
  -- Managers can see their direct/indirect reports' assigned data
  (assigned_to IS NOT NULL AND EXISTS (
    WITH RECURSIVE reporting_chain AS (
      SELECT id FROM profiles WHERE reports_to = auth.uid()
      UNION ALL
      SELECT p.id FROM profiles p
      INNER JOIN reporting_chain rc ON p.reports_to = rc.id
    )
    SELECT 1 FROM reporting_chain WHERE id = demandcom.assigned_to
  ))
);

-- Update DELETE policy to include all admin roles using helper function
DROP POLICY IF EXISTS "Admins can delete demandcom records" ON demandcom;

CREATE POLICY "Admins can delete demandcom records"
ON demandcom FOR DELETE TO authenticated
USING (is_admin_user(auth.uid()));

-- 4. Fix Project-Related Tables RLS - Allow all authenticated users to view

-- project_demandcom_checklist
DROP POLICY IF EXISTS "Users can view demandcom checklist for accessible projects" ON project_demandcom_checklist;

CREATE POLICY "All authenticated users can view demandcom checklist"
ON project_demandcom_checklist FOR SELECT TO authenticated
USING (true);

-- project_livecom_checklist
DROP POLICY IF EXISTS "Users can view livecom checklist for accessible projects" ON project_livecom_checklist;

CREATE POLICY "All authenticated users can view livecom checklist"
ON project_livecom_checklist FOR SELECT TO authenticated
USING (true);

-- project_digicom_checklist (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_digicom_checklist') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view digicom checklist for accessible projects" ON project_digicom_checklist';
    EXECUTE 'CREATE POLICY "All authenticated users can view digicom checklist" ON project_digicom_checklist FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

-- project_team_members
DROP POLICY IF EXISTS "Users can view team members for accessible projects" ON project_team_members;

CREATE POLICY "All authenticated users can view team members"
ON project_team_members FOR SELECT TO authenticated
USING (true);

-- 5. Update can_access_project function to use is_admin_user helper
CREATE OR REPLACE FUNCTION public.can_access_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  project_creator_id uuid;
BEGIN
  SELECT created_by INTO project_creator_id
  FROM projects WHERE id = _project_id;
  
  RETURN (
    project_creator_id = _user_id
    OR public.is_project_team_member(_user_id, _project_id)
    OR public.is_admin_user(_user_id)
  );
END;
$$;