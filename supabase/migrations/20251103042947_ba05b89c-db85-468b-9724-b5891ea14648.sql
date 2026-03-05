-- Create security definer function to check project access without RLS recursion
CREATE OR REPLACE FUNCTION public.can_access_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = _project_id
    AND (
      -- User created the project
      p.created_by = _user_id
      OR
      -- User is a team member (bypasses RLS due to SECURITY DEFINER)
      EXISTS (
        SELECT 1 FROM project_team_members ptm
        WHERE ptm.project_id = p.id
        AND ptm.user_id = _user_id
      )
      OR
      -- User has admin role
      public.has_role(_user_id, 'admin'::app_role)
      OR
      public.has_role(_user_id, 'super_admin'::app_role)
      OR
      public.has_role(_user_id, 'platform_admin'::app_role)
      OR
      public.has_role(_user_id, 'admin_tech'::app_role)
      OR
      public.has_role(_user_id, 'admin_administration'::app_role)
    )
  )
$$;

-- Update project_team_members SELECT policy to use the new function
DROP POLICY IF EXISTS "Users can view team members for accessible projects" ON project_team_members;

CREATE POLICY "Users can view team members for accessible projects"
ON project_team_members
FOR SELECT
USING (public.can_access_project(auth.uid(), project_id));

-- Update project_team_members ALL policy to include all admin roles
DROP POLICY IF EXISTS "Project creators and admins can manage team members" ON project_team_members;

CREATE POLICY "Project creators and admins can manage team members"
ON project_team_members
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_team_members.project_id
    AND (
      auth.uid() = projects.created_by
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'platform_admin'::app_role)
      OR public.has_role(auth.uid(), 'admin_tech'::app_role)
      OR public.has_role(auth.uid(), 'admin_administration'::app_role)
    )
  )
);

-- Update project_files INSERT policy
DROP POLICY IF EXISTS "Users can upload files to accessible projects" ON project_files;

CREATE POLICY "Users can upload files to accessible projects"
ON project_files
FOR INSERT
WITH CHECK (public.can_access_project(auth.uid(), project_id));

-- Update project_files SELECT policy
DROP POLICY IF EXISTS "Users can view files for accessible projects" ON project_files;

CREATE POLICY "Users can view files for accessible projects"
ON project_files
FOR SELECT
USING (public.can_access_project(auth.uid(), project_id));

-- Update project_quotations SELECT policy
DROP POLICY IF EXISTS "Users can view quotations for accessible projects" ON project_quotations;

CREATE POLICY "Users can view quotations for accessible projects"
ON project_quotations
FOR SELECT
USING (public.can_access_project(auth.uid(), project_id));