
-- Drop existing policies and recreate with all admin roles
DROP POLICY IF EXISTS "Admins can create teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can delete teams" ON public.teams;
DROP POLICY IF EXISTS "Team leads and admins can update their teams" ON public.teams;

-- Create updated INSERT policy including admin_administration and admin_tech
CREATE POLICY "Admins can create teams" ON public.teams
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role) OR
  has_role(auth.uid(), 'admin_administration'::app_role) OR
  has_role(auth.uid(), 'admin_tech'::app_role)
);

-- Create updated DELETE policy
CREATE POLICY "Admins can delete teams" ON public.teams
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role) OR
  has_role(auth.uid(), 'admin_administration'::app_role) OR
  has_role(auth.uid(), 'admin_tech'::app_role)
);

-- Create updated UPDATE policy
CREATE POLICY "Team leads and admins can update their teams" ON public.teams
FOR UPDATE TO authenticated
USING (
  team_lead_id = auth.uid() OR
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role) OR
  has_role(auth.uid(), 'admin_administration'::app_role) OR
  has_role(auth.uid(), 'admin_tech'::app_role)
);
