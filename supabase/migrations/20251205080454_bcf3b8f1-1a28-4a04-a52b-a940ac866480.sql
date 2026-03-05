
-- Create a security definer function to get all distinct activity names
-- This allows the filter dropdown to show all activities regardless of RLS
CREATE OR REPLACE FUNCTION public.get_all_demandcom_activities()
RETURNS TABLE(activity_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT d.activity_name
  FROM demandcom d
  WHERE d.activity_name IS NOT NULL
  ORDER BY d.activity_name;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_all_demandcom_activities() TO authenticated;
