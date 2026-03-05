-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view their team memberships" ON public.team_members;

-- Create a new policy that allows:
-- 1. Users to see their own membership
-- 2. Team leads to see all members of teams they lead (via teams.team_lead_id)
-- 3. Users to see members of teams they belong to (for team hierarchy visibility)
-- 4. Admins to see all
CREATE POLICY "Users can view team memberships" 
ON public.team_members
FOR SELECT
USING (
  -- User can see their own membership
  user_id = auth.uid()
  -- Or user is a team lead of this team
  OR EXISTS (
    SELECT 1 FROM teams 
    WHERE teams.id = team_members.team_id 
    AND teams.team_lead_id = auth.uid()
  )
  -- Or user is a member of the same team (needed for hierarchy)
  OR EXISTS (
    SELECT 1 FROM team_members tm2 
    WHERE tm2.team_id = team_members.team_id 
    AND tm2.user_id = auth.uid()
    AND tm2.is_active = true
  )
  -- Or user is an admin
  OR has_role(auth.uid(), 'platform_admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin_administration'::app_role)
  OR has_role(auth.uid(), 'admin_tech'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);