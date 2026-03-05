-- Create a security definer function to get all distinct activity names
-- This allows users to see all activity names for filtering, regardless of RLS
CREATE OR REPLACE FUNCTION public.get_all_activity_names()
RETURNS TABLE(activity_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT d.activity_name
  FROM public.demandcom d
  WHERE d.activity_name IS NOT NULL 
    AND d.activity_name != ''
  ORDER BY d.activity_name;
$$;