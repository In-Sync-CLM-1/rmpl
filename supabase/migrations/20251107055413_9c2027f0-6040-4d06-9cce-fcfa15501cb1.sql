-- Drop the old permissive policy
DROP POLICY IF EXISTS "Authenticated users can view all demandcom records" ON demandcom;

-- Create new hierarchy-based policy
CREATE POLICY "Users can view demandcom based on assignment and hierarchy"
ON demandcom
FOR SELECT
TO authenticated
USING (
  -- User can see records assigned to them
  assigned_to = auth.uid()
  OR
  -- User can see records assigned to team members (via hierarchy)
  (assigned_to IS NOT NULL AND can_access_user(auth.uid(), assigned_to))
  OR
  -- User can see records they created/uploaded
  created_by = auth.uid()
  OR
  -- All admin roles can see everything
  has_role(auth.uid(), 'admin'::app_role)
  OR
  has_role(auth.uid(), 'super_admin'::app_role)
  OR
  has_role(auth.uid(), 'platform_admin'::app_role)
  OR
  has_role(auth.uid(), 'admin_administration'::app_role)
  OR
  has_role(auth.uid(), 'admin_tech'::app_role)
);