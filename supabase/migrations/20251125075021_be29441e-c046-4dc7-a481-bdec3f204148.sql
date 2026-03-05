-- Add composite indexes for better query performance on demandcom
CREATE INDEX IF NOT EXISTS idx_demandcom_assigned_created ON public.demandcom(assigned_to, created_at DESC) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_demandcom_disposition_created ON public.demandcom(latest_disposition, created_at DESC) WHERE latest_disposition IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_demandcom_activity_created ON public.demandcom(activity_name, created_at DESC) WHERE activity_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_demandcom_created_at_only ON public.demandcom(created_at DESC);

-- Add partial index for assigned records for faster filtering
CREATE INDEX IF NOT EXISTS idx_demandcom_assigned_not_null ON public.demandcom(assigned_to) WHERE assigned_to IS NOT NULL;

-- Optimize the RLS policies by consolidating and simplifying
-- Drop the old conflicting SELECT policies
DROP POLICY IF EXISTS "Users can view assigned demandcom records" ON public.demandcom;
DROP POLICY IF EXISTS "Users can view demandcom based on assignment and hierarchy" ON public.demandcom;

-- Create a single, optimized SELECT policy
CREATE POLICY "Users can view demandcom records - optimized"
ON public.demandcom
FOR SELECT
USING (
  -- Own assigned records (fastest check first)
  assigned_to = auth.uid()
  OR
  -- Own created records
  created_by = auth.uid()
  OR
  -- Admin roles (quick role check)
  has_role(auth.uid(), 'admin'::app_role)
  OR
  has_role(auth.uid(), 'super_admin'::app_role)
  OR
  has_role(auth.uid(), 'platform_admin'::app_role)
  OR
  has_role(auth.uid(), 'admin_administration'::app_role)
  OR
  has_role(auth.uid(), 'admin_tech'::app_role)
  OR
  -- Hierarchy access (only if needed)
  (assigned_to IS NOT NULL AND can_access_user(auth.uid(), assigned_to))
);