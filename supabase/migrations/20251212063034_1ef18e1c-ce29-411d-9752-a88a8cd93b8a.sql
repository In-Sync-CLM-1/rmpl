-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view projects based on hierarchy" ON projects;

-- Create updated SELECT policy that includes CSBD role
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
  -- Admin roles can view all
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'platform_admin'::app_role)
  OR has_role(auth.uid(), 'admin_tech'::app_role)
  OR has_role(auth.uid(), 'admin_administration'::app_role)
  -- CSBD team can view all projects
  OR has_role(auth.uid(), 'csbd'::app_role)
);