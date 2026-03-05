-- First, create a security definer function to check if user is member of a team
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id
    AND team_id = _team_id
    AND is_active = true
  )
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view team memberships" ON public.team_members;

-- Create a new policy using the security definer function
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
  -- Or user is a member of the same team (using security definer function)
  OR public.is_team_member(auth.uid(), team_id)
  -- Or user is an admin
  OR has_role(auth.uid(), 'platform_admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin_administration'::app_role)
  OR has_role(auth.uid(), 'admin_tech'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);