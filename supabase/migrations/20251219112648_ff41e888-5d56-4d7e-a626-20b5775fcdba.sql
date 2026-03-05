-- Create a function to get all subordinate IDs (runs once per query, not per row)
CREATE OR REPLACE FUNCTION public.get_user_subordinate_ids(p_user_id UUID)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH RECURSIVE reporting_chain AS (
    SELECT id FROM profiles WHERE reports_to = p_user_id
    UNION ALL
    SELECT p.id FROM profiles p JOIN reporting_chain rc ON p.reports_to = rc.id
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[]) FROM reporting_chain;
$$;

-- Drop the slow policy
DROP POLICY IF EXISTS "Users can view demandcom records with proper hierarchy" ON demandcom;

-- Create optimized policy using the function
CREATE POLICY "Users can view demandcom records with proper hierarchy"
ON demandcom FOR SELECT TO authenticated
USING (
  assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR public.is_admin_user(auth.uid())
  OR assigned_to = ANY(public.get_user_subordinate_ids(auth.uid()))
);