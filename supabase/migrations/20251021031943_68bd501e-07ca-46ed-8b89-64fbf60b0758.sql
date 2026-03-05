-- Fix team_members RLS policies to include platform_admin

DROP POLICY IF EXISTS "Users can view their team memberships" ON public.team_members;
DROP POLICY IF EXISTS "Team leads and admins can manage team members" ON public.team_members;

-- Allow users to view their own team memberships, or if they're any type of admin
CREATE POLICY "Users can view their team memberships"
ON public.team_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'platform_admin'::app_role)
);

-- Allow team leads and admins to manage team members
CREATE POLICY "Team leads and admins can manage team members"
ON public.team_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM teams 
    WHERE teams.id = team_members.team_id 
    AND (
      teams.team_lead_id = auth.uid() 
      OR has_role(auth.uid(), 'admin'::app_role) 
      OR has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'platform_admin'::app_role)
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'platform_admin'::app_role)
);