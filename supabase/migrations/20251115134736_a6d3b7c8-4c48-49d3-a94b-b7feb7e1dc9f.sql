-- Create function to get daily record counts for last N days
CREATE OR REPLACE FUNCTION get_daily_record_counts(days integer)
RETURNS TABLE(date date, created_count bigint, updated_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      CURRENT_DATE - days,
      CURRENT_DATE,
      '1 day'::interval
    )::date AS date
  ),
  created_records AS (
    SELECT 
      DATE(created_at) AS date,
      COUNT(*) AS count
    FROM (
      SELECT created_at FROM master
      UNION ALL
      SELECT created_at FROM demandcom
    ) combined
    WHERE DATE(created_at) >= CURRENT_DATE - days
    GROUP BY DATE(created_at)
  ),
  updated_records AS (
    SELECT 
      DATE(updated_at) AS date,
      COUNT(*) AS count
    FROM (
      SELECT created_at, updated_at FROM master
      WHERE EXTRACT(EPOCH FROM (updated_at - created_at)) > 60
      UNION ALL
      SELECT created_at, updated_at FROM demandcom
      WHERE EXTRACT(EPOCH FROM (updated_at - created_at)) > 60
    ) combined
    WHERE DATE(updated_at) >= CURRENT_DATE - days
    GROUP BY DATE(updated_at)
  )
  SELECT 
    ds.date,
    COALESCE(cr.count, 0) AS created_count,
    COALESCE(ur.count, 0) AS updated_count
  FROM date_series ds
  LEFT JOIN created_records cr ON ds.date = cr.date
  LEFT JOIN updated_records ur ON ds.date = ur.date
  ORDER BY ds.date;
END;
$$;