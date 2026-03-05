
-- Drop and recreate the function with proper sorting (latest first)
DROP FUNCTION IF EXISTS public.get_demandcom_activity_stats();

CREATE OR REPLACE FUNCTION public.get_demandcom_activity_stats()
RETURNS TABLE (
  activity_name text,
  total bigint,
  tagged bigint,
  interested bigint,
  registered bigint,
  latest_created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    activity_name,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE assigned_to IS NOT NULL) as tagged,
    COUNT(*) FILTER (WHERE latest_disposition = 'Interested') as interested,
    COUNT(*) FILTER (WHERE latest_disposition = 'Registered') as registered,
    MAX(created_at) as latest_created_at
  FROM demandcom
  WHERE activity_name IS NOT NULL AND activity_name != ''
  GROUP BY activity_name
  ORDER BY MAX(created_at) DESC NULLS LAST;
$$;
