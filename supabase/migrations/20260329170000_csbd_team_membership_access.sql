-- Allow CSBD team members (by team_members table) to access CSBD tables
-- Previously only users with explicit 'csbd' role in user_roles had access

-- Helper function: check if user is in a team whose name contains 'CSBD'
CREATE OR REPLACE FUNCTION is_csbd_team_member(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM team_members tm
    JOIN teams t ON t.id = tm.team_id
    WHERE tm.user_id = uid
      AND tm.is_active = true
      AND UPPER(t.name) LIKE '%CSBD%'
  );
$$;

-- Update csbd_targets SELECT policy to include team membership
DROP POLICY IF EXISTS "CSBD and leadership can view targets" ON csbd_targets;
CREATE POLICY "CSBD and leadership can view targets"
ON csbd_targets
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'csbd'::app_role) OR
  is_csbd_team_member(auth.uid()) OR
  has_role(auth.uid(), 'leadership'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'platform_admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin_administration'::app_role) OR
  has_role(auth.uid(), 'admin_tech'::app_role)
);

-- Update csbd_projections SELECT policy to include team membership
DROP POLICY IF EXISTS "Users can view their own projections" ON csbd_projections;
CREATE POLICY "Users can view their own projections"
ON csbd_projections
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.reports_to = auth.uid()
    AND profiles.id = csbd_projections.user_id
  ) OR
  has_role(auth.uid(), 'csbd'::app_role) OR
  is_csbd_team_member(auth.uid()) OR
  has_role(auth.uid(), 'leadership'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'platform_admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin_administration'::app_role) OR
  has_role(auth.uid(), 'admin_tech'::app_role)
);
