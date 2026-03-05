-- Drop the existing UPDATE policy
DROP POLICY IF EXISTS "Project creators and admins can update projects" ON projects;

-- Create updated UPDATE policy with hierarchy support (matching SELECT policy logic)
CREATE POLICY "Users can update projects based on hierarchy" 
ON projects FOR UPDATE 
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
  -- Admin roles can update all
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'platform_admin'::app_role)
  OR has_role(auth.uid(), 'admin_tech'::app_role)
  OR has_role(auth.uid(), 'admin_administration'::app_role)
  -- CSBD role can update projects they can view
  OR has_role(auth.uid(), 'csbd'::app_role)
);