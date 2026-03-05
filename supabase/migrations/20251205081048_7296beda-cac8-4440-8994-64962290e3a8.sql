
-- Create a security definer function to get aggregated activity stats
-- This allows the Activity Report table to show all activities regardless of RLS
CREATE OR REPLACE FUNCTION public.get_demandcom_activity_stats()
RETURNS TABLE(
  activity_name text,
  total_count bigint,
  tagged_count bigint,
  interested_count bigint,
  registered_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    d.activity_name,
    COUNT(*)::bigint as total_count,
    COUNT(d.latest_disposition)::bigint as tagged_count,
    COUNT(CASE WHEN d.latest_subdisposition = 'Interested' THEN 1 END)::bigint as interested_count,
    COUNT(CASE WHEN d.latest_subdisposition = 'Registered' THEN 1 END)::bigint as registered_count
  FROM demandcom d
  WHERE d.activity_name IS NOT NULL
  GROUP BY d.activity_name
  ORDER BY COUNT(*) DESC;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_demandcom_activity_stats() TO authenticated;
