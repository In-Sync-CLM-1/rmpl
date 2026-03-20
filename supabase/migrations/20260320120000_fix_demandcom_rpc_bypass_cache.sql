-- Fix: RPC functions were falling back to stale materialized view caches
-- when no filters were applied, causing dashboard to show outdated data.
-- Now always query the raw demandcom table for fresh results.

-- 1. Fix get_demandcom_kpi_metrics: always query fresh data
CREATE OR REPLACE FUNCTION public.get_demandcom_kpi_metrics(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_activity_filter text DEFAULT NULL,
  p_agent_filter uuid DEFAULT NULL,
  p_today_start timestamptz DEFAULT NULL
)
RETURNS TABLE(total_count bigint, assigned_count bigint, registered_count bigint, updated_today_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '60s'
AS $function$
BEGIN
  RETURN QUERY
  SELECT COUNT(*)::bigint, COUNT(*) FILTER (WHERE assigned_to IS NOT NULL)::bigint,
    COUNT(*) FILTER (WHERE latest_subdisposition = 'Registered'
      AND updated_at >= COALESCE(p_start_date, '1970-01-01'::timestamptz)
      AND updated_at <= COALESCE(p_end_date, CURRENT_TIMESTAMP))::bigint,
    COUNT(*) FILTER (WHERE updated_at >= COALESCE(p_today_start, CURRENT_DATE::timestamptz))::bigint
  FROM demandcom
  WHERE (p_activity_filter IS NULL OR activity_name = p_activity_filter)
    AND (p_agent_filter IS NULL OR assigned_to = p_agent_filter)
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date);
END;
$function$;

-- 2. Fix get_demandcom_disposition_breakdown: always query fresh data
CREATE OR REPLACE FUNCTION public.get_demandcom_disposition_breakdown(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_activity_filter text DEFAULT NULL,
  p_agent_filter uuid DEFAULT NULL
)
RETURNS TABLE(disposition text, count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '60s'
AS $function$
BEGIN
  RETURN QUERY
  SELECT COALESCE(d.latest_disposition, 'Unknown')::text, COUNT(*)::bigint
  FROM demandcom d
  WHERE d.latest_disposition IS NOT NULL AND d.latest_disposition != ''
    AND (p_activity_filter IS NULL OR d.activity_name = p_activity_filter)
    AND (p_agent_filter IS NULL OR d.assigned_to = p_agent_filter)
    AND (p_start_date IS NULL OR d.created_at >= p_start_date)
    AND (p_end_date IS NULL OR d.created_at <= p_end_date)
  GROUP BY d.latest_disposition ORDER BY COUNT(*) DESC;
END;
$function$;
