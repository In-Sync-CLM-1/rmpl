-- Drop the overly permissive policy that allows all authenticated users to view all projects
DROP POLICY IF EXISTS "All authenticated users can view projects" ON projects;

-- Drop the existing restrictive policy to recreate with hierarchy support
DROP POLICY IF EXISTS "Users can view projects they created or are team members of" ON projects;

-- Create updated SELECT policy with full hierarchy support
CREATE POLICY "Users can view projects based on hierarchy" 
ON projects FOR SELECT 
USING (
  -- User created the project
  auth.uid() = created_by
  -- User is project owner
  OR auth.uid() = project_owner
  -- User is a team member
  OR is_project_team_member(auth.uid(), id)
  -- User has hierarchy access to project creator
  OR can_access_user(auth.uid(), created_by)
  -- User has hierarchy access to project owner
  OR can_access_user(auth.uid(), project_owner)
  -- Admin roles can see all
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'platform_admin'::app_role)
  OR has_role(auth.uid(), 'admin_tech'::app_role)
  OR has_role(auth.uid(), 'admin_administration'::app_role)
);