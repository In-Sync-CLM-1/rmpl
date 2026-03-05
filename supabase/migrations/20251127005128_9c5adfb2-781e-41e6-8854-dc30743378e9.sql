
-- Drop ALL existing policies on csbd_projections
DROP POLICY IF EXISTS "Admins can manage all projections" ON csbd_projections;
DROP POLICY IF EXISTS "Users can view their own projections" ON csbd_projections;
DROP POLICY IF EXISTS "Users can manage their own projections" ON csbd_projections;

-- Drop ALL existing policies on csbd_targets
DROP POLICY IF EXISTS "Admins can manage targets" ON csbd_targets;
DROP POLICY IF EXISTS "CSBD and leadership can view targets" ON csbd_targets;

-- Create updated policies for csbd_projections that include all admin roles
CREATE POLICY "Admins can manage all projections"
ON csbd_projections
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin_administration'::app_role) OR
  has_role(auth.uid(), 'admin_tech'::app_role)
);

CREATE POLICY "Users can view their own projections"
ON csbd_projections
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  -- Users can view projections of their direct reports
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.reports_to = auth.uid() 
    AND profiles.id = csbd_projections.user_id
  ) OR
  -- CSBD and leadership can view all projections
  has_role(auth.uid(), 'csbd'::app_role) OR 
  has_role(auth.uid(), 'leadership'::app_role) OR
  -- All admin roles can view all projections
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin_administration'::app_role) OR
  has_role(auth.uid(), 'admin_tech'::app_role)
);

CREATE POLICY "Users can manage their own projections"
ON csbd_projections
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create updated policies for csbd_targets that include all admin roles
CREATE POLICY "Admins can manage targets"
ON csbd_targets
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin_administration'::app_role) OR
  has_role(auth.uid(), 'admin_tech'::app_role)
);

CREATE POLICY "CSBD and leadership can view targets"
ON csbd_targets
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'csbd'::app_role) OR 
  has_role(auth.uid(), 'leadership'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'admin_administration'::app_role) OR
  has_role(auth.uid(), 'admin_tech'::app_role)
);

-- Check if csbd_actuals table exists and update policies
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'csbd_actuals') THEN
    -- Drop existing policies if any
    DROP POLICY IF EXISTS "Admins can manage actuals" ON csbd_actuals;
    DROP POLICY IF EXISTS "Users can view actuals" ON csbd_actuals;
    
    -- Create policies for csbd_actuals
    CREATE POLICY "Admins can manage actuals"
    ON csbd_actuals
    FOR ALL
    TO authenticated
    USING (
      has_role(auth.uid(), 'admin'::app_role) OR 
      has_role(auth.uid(), 'platform_admin'::app_role) OR
      has_role(auth.uid(), 'super_admin'::app_role) OR
      has_role(auth.uid(), 'admin_administration'::app_role) OR
      has_role(auth.uid(), 'admin_tech'::app_role)
    );
    
    CREATE POLICY "Users can view actuals"
    ON csbd_actuals
    FOR SELECT
    TO authenticated
    USING (
      has_role(auth.uid(), 'csbd'::app_role) OR 
      has_role(auth.uid(), 'leadership'::app_role) OR
      has_role(auth.uid(), 'admin'::app_role) OR 
      has_role(auth.uid(), 'platform_admin'::app_role) OR
      has_role(auth.uid(), 'super_admin'::app_role) OR
      has_role(auth.uid(), 'admin_administration'::app_role) OR
      has_role(auth.uid(), 'admin_tech'::app_role)
    );
  END IF;
END $$;
