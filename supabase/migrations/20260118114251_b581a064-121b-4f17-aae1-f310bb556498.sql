
-- Fix: Update get_demandcom_kpi_metrics to count registrations based on updated_at (when registration occurred)
-- instead of created_at (when record was created)
CREATE OR REPLACE FUNCTION public.get_demandcom_kpi_metrics(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_activity_filter text DEFAULT NULL,
  p_agent_filter uuid DEFAULT NULL,
  p_today_start timestamptz DEFAULT NULL
)
RETURNS TABLE(
  total_count bigint,
  assigned_count bigint,
  registered_count bigint,
  updated_today_count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE assigned_to IS NOT NULL) as assigned_count,
    -- Fix: Count registrations where updated_at is in the date range (when the registration action occurred)
    COUNT(*) FILTER (
      WHERE latest_subdisposition = 'Registered' 
      AND updated_at >= COALESCE(p_start_date, '1970-01-01'::timestamptz)
      AND updated_at <= COALESCE(p_end_date, CURRENT_TIMESTAMP)
    ) as registered_count,
    COUNT(*) FILTER (WHERE updated_at >= COALESCE(p_today_start, CURRENT_DATE::timestamptz)) as updated_today_count
  FROM demandcom
  WHERE 
    (p_activity_filter IS NULL OR activity_name = p_activity_filter)
    AND (p_agent_filter IS NULL OR assigned_to = p_agent_filter)
    -- Keep created_at filter for total/assigned counts
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date);
$$;
