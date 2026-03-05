CREATE OR REPLACE FUNCTION public.get_activity_names_with_counts()
RETURNS TABLE(activity_name TEXT, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT d.activity_name::TEXT, COUNT(*)::BIGINT as count
  FROM demandcom d
  WHERE d.activity_name IS NOT NULL AND d.activity_name != ''
  GROUP BY d.activity_name
  ORDER BY d.activity_name;
END;
$$;