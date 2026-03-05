-- Update user_roles SELECT policy to include all admin roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles" 
ON public.user_roles
FOR SELECT
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'platform_admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin_administration'::app_role)
  OR has_role(auth.uid(), 'admin_tech'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Update team_members SELECT policy to include all admin roles
DROP POLICY IF EXISTS "Users can view their team memberships" ON public.team_members;

CREATE POLICY "Users can view their team memberships"
ON public.team_members
FOR SELECT
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'platform_admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin_administration'::app_role)
  OR has_role(auth.uid(), 'admin_tech'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);