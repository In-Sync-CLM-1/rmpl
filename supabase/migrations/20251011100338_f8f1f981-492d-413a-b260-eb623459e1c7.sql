-- Create function to get user's highest designation level
CREATE OR REPLACE FUNCTION public.get_user_designation_level(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(MAX(d.level), 0)
  FROM public.user_designations ud
  JOIN public.designations d ON d.id = ud.designation_id
  WHERE ud.user_id = _user_id
    AND ud.is_current = true
    AND d.is_active = true
$$;

-- Create function to check if user can access another user based on hierarchy
CREATE OR REPLACE FUNCTION public.can_access_user(_accessor_id uuid, _target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- User can access themselves
    _accessor_id = _target_id
    OR
    -- User can access those with lower or equal designation level
    public.get_user_designation_level(_accessor_id) >= public.get_user_designation_level(_target_id)
    OR
    -- Admins and super_admins can access everyone
    public.has_role(_accessor_id, 'admin'::app_role)
    OR
    public.has_role(_accessor_id, 'super_admin'::app_role)
$$;

-- Update profiles RLS policy to enforce hierarchy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view profiles based on hierarchy"
ON public.profiles
FOR SELECT
USING (public.can_access_user(auth.uid(), id));

-- Update candidates RLS to respect hierarchy
DROP POLICY IF EXISTS "Authenticated users can view candidates" ON public.candidates;

CREATE POLICY "Users can view candidates based on hierarchy"
ON public.candidates
FOR SELECT
USING (
  public.can_access_user(auth.uid(), created_by)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Users can update candidates based on hierarchy"
ON public.candidates
FOR UPDATE
USING (
  public.can_access_user(auth.uid(), created_by)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update campaigns RLS to respect hierarchy
DROP POLICY IF EXISTS "Authenticated users can view campaigns" ON public.campaigns;

CREATE POLICY "Users can view campaigns based on hierarchy"
ON public.campaigns
FOR SELECT
USING (
  public.can_access_user(auth.uid(), created_by)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update email templates RLS to respect hierarchy
DROP POLICY IF EXISTS "Authenticated users can view email templates" ON public.email_templates;

CREATE POLICY "Users can view templates based on hierarchy"
ON public.email_templates
FOR SELECT
USING (
  public.can_access_user(auth.uid(), created_by)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);