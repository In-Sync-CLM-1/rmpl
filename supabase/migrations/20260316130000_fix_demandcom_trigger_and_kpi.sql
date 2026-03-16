-- Fix: Recreate missing demandcom field changes trigger + fix KPI function
-- Root cause: track_demandcom_field_changes trigger was missing from demandcom table,
-- causing demandcom_field_changes to have 0 rows despite 33K recent updates.
-- Also: get_demandcom_kpi_metrics was missing SECURITY DEFINER.

-- 1. Recreate the field changes trigger
DROP TRIGGER IF EXISTS track_demandcom_field_changes ON public.demandcom;
CREATE TRIGGER track_demandcom_field_changes
  AFTER UPDATE ON public.demandcom
  FOR EACH ROW
  EXECUTE FUNCTION public.log_demandcom_field_changes();

-- 2. Fix get_demandcom_kpi_metrics: add SECURITY DEFINER + statement_timeout
CREATE OR REPLACE FUNCTION public.get_demandcom_kpi_metrics(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_activity_filter text DEFAULT NULL,
  p_agent_filter uuid DEFAULT NULL,
  p_today_start timestamptz DEFAULT NULL
)
RETURNS TABLE(total_count bigint, assigned_count bigint, registered_count bigint, updated_today_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $function$
  SELECT
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE assigned_to IS NOT NULL) as assigned_count,
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
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date);
$function$;

-- 3. Add composite indexes for demandcom_field_changes queries
CREATE INDEX IF NOT EXISTS idx_dfc_field_changed_at
  ON public.demandcom_field_changes (field_name, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_dfc_disposition_changed_by
  ON public.demandcom_field_changes (field_name, changed_by, changed_at DESC)
  WHERE field_name = 'disposition';
