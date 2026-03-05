-- Drop all policies that depend on can_access_project function
DROP POLICY IF EXISTS "Users can view team members for accessible projects" ON project_team_members;
DROP POLICY IF EXISTS "Project creators and admins can manage team members" ON project_team_members;
DROP POLICY IF EXISTS "Users can upload files to accessible projects" ON project_files;
DROP POLICY IF EXISTS "Users can view files for accessible projects" ON project_files;
DROP POLICY IF EXISTS "Users can view quotations for accessible projects" ON project_quotations;

-- Now drop the old function
DROP FUNCTION IF EXISTS public.can_access_project(_user_id uuid, _project_id uuid);

-- Step 1: Create helper function that queries ONLY project_team_members
CREATE OR REPLACE FUNCTION public.is_project_team_member(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_team_members
    WHERE project_id = _project_id
    AND user_id = _user_id
  )
$$;

-- Step 2: Create new can_access_project with PL/pgSQL to bypass RLS
CREATE OR REPLACE FUNCTION public.can_access_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_creator_id uuid;
BEGIN
  -- Get project creator directly (SECURITY DEFINER bypasses RLS)
  SELECT created_by INTO project_creator_id
  FROM projects
  WHERE id = _project_id;
  
  -- Check all access conditions
  RETURN (
    project_creator_id = _user_id
    OR
    public.is_project_team_member(_user_id, _project_id)
    OR
    public.has_role(_user_id, 'admin'::app_role)
    OR
    public.has_role(_user_id, 'super_admin'::app_role)
    OR
    public.has_role(_user_id, 'platform_admin'::app_role)
    OR
    public.has_role(_user_id, 'admin_tech'::app_role)
    OR
    public.has_role(_user_id, 'admin_administration'::app_role)
  );
END;
$$;

-- Step 3: Update projects SELECT policy (CRITICAL - was never updated before)
DROP POLICY IF EXISTS "Users can view projects they created or are team members of" ON projects;

CREATE POLICY "Users can view projects they created or are team members of"
ON projects
FOR SELECT
USING (
  auth.uid() = created_by
  OR
  public.is_project_team_member(auth.uid(), id)
  OR
  public.has_role(auth.uid(), 'admin'::app_role)
  OR
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR
  public.has_role(auth.uid(), 'platform_admin'::app_role)
  OR
  public.has_role(auth.uid(), 'admin_tech'::app_role)
  OR
  public.has_role(auth.uid(), 'admin_administration'::app_role)
);

-- Step 4: Update projects UPDATE policy
DROP POLICY IF EXISTS "Project creators and admins can update projects" ON projects;

CREATE POLICY "Project creators and admins can update projects"
ON projects
FOR UPDATE
USING (
  auth.uid() = created_by
  OR
  public.has_role(auth.uid(), 'admin'::app_role)
  OR
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR
  public.has_role(auth.uid(), 'platform_admin'::app_role)
  OR
  public.has_role(auth.uid(), 'admin_tech'::app_role)
  OR
  public.has_role(auth.uid(), 'admin_administration'::app_role)
);

-- Step 5: Update projects DELETE policy
DROP POLICY IF EXISTS "Project creators and admins can delete projects" ON projects;

CREATE POLICY "Project creators and admins can delete projects"
ON projects
FOR DELETE
USING (
  auth.uid() = created_by
  OR
  public.has_role(auth.uid(), 'admin'::app_role)
  OR
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR
  public.has_role(auth.uid(), 'platform_admin'::app_role)
  OR
  public.has_role(auth.uid(), 'admin_tech'::app_role)
  OR
  public.has_role(auth.uid(), 'admin_administration'::app_role)
);

-- Step 6: Recreate project_team_members policies
CREATE POLICY "Users can view team members for accessible projects"
ON project_team_members
FOR SELECT
USING (public.can_access_project(auth.uid(), project_id));

CREATE POLICY "Project creators and admins can manage team members"
ON project_team_members
FOR ALL
USING (public.can_access_project(auth.uid(), project_id));

-- Step 7: Recreate project_files policies
CREATE POLICY "Users can upload files to accessible projects"
ON project_files
FOR INSERT
WITH CHECK (public.can_access_project(auth.uid(), project_id));

CREATE POLICY "Users can view files for accessible projects"
ON project_files
FOR SELECT
USING (public.can_access_project(auth.uid(), project_id));

-- Step 8: Recreate project_quotations policy
CREATE POLICY "Users can view quotations for accessible projects"
ON project_quotations
FOR SELECT
USING (public.can_access_project(auth.uid(), project_id));