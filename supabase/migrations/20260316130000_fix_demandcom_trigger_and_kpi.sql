-- Fix: Recreate missing demandcom field changes trigger + fix KPI function
-- Root cause: track_demandcom_field_changes trigger was missing from demandcom table,
-- causing demandcom_field_changes to have 0 rows despite 33K recent updates.
-- Also: get_demandcom_kpi_metrics was missing SECURITY DEFINER.
-- Also: DB is very slow (43s for COUNT on 40K rows) - add materialized view caches.

-- 1. Recreate the field changes trigger
DROP TRIGGER IF EXISTS track_demandcom_field_changes ON public.demandcom;
CREATE TRIGGER track_demandcom_field_changes
  AFTER UPDATE ON public.demandcom
  FOR EACH ROW
  EXECUTE FUNCTION public.log_demandcom_field_changes();

-- 2. Backfill demandcom_field_changes from current demandcom state
INSERT INTO demandcom_field_changes (demandcom_id, changed_by, changed_at, field_name, old_value, new_value)
SELECT id, updated_by, updated_at, 'disposition', NULL, latest_disposition
FROM demandcom
WHERE updated_by IS NOT NULL AND latest_disposition IS NOT NULL AND latest_disposition != ''
ON CONFLICT DO NOTHING;

INSERT INTO demandcom_field_changes (demandcom_id, changed_by, changed_at, field_name, old_value, new_value)
SELECT id, updated_by, updated_at, 'subdisposition', NULL, latest_subdisposition
FROM demandcom
WHERE updated_by IS NOT NULL AND latest_subdisposition IS NOT NULL AND latest_subdisposition != ''
ON CONFLICT DO NOTHING;

-- 3. Add composite indexes for demandcom_field_changes queries
CREATE INDEX IF NOT EXISTS idx_dfc_field_changed_at
  ON public.demandcom_field_changes (field_name, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_dfc_disposition_changed_by
  ON public.demandcom_field_changes (field_name, changed_by, changed_at DESC)
  WHERE field_name = 'disposition';

-- 4. Materialized view caches for slow KPI/disposition queries
DROP MATERIALIZED VIEW IF EXISTS demandcom_kpi_cache;
CREATE MATERIALIZED VIEW demandcom_kpi_cache AS
SELECT
  COUNT(*)::int as total_count,
  COUNT(*) FILTER (WHERE assigned_to IS NOT NULL)::int as assigned_count,
  COUNT(*) FILTER (WHERE latest_subdisposition = 'Registered')::int as registered_count,
  COUNT(*) FILTER (WHERE updated_at >= CURRENT_DATE)::int as updated_today_count
FROM demandcom;
CREATE UNIQUE INDEX ON demandcom_kpi_cache ((total_count IS NOT NULL));
GRANT SELECT ON demandcom_kpi_cache TO anon, authenticated;

DROP MATERIALIZED VIEW IF EXISTS demandcom_disposition_cache;
CREATE MATERIALIZED VIEW demandcom_disposition_cache AS
SELECT
  COALESCE(latest_disposition, 'Unknown') as disposition,
  COUNT(*)::int as count
FROM demandcom
WHERE latest_disposition IS NOT NULL AND latest_disposition != ''
GROUP BY latest_disposition
ORDER BY COUNT(*) DESC;
CREATE UNIQUE INDEX ON demandcom_disposition_cache (disposition);
GRANT SELECT ON demandcom_disposition_cache TO anon, authenticated;

-- 5. Fix get_demandcom_kpi_metrics: SECURITY DEFINER + use cache
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
  IF p_activity_filter IS NULL AND p_agent_filter IS NULL THEN
    RETURN QUERY SELECT kc.total_count::bigint, kc.assigned_count::bigint,
      kc.registered_count::bigint, kc.updated_today_count::bigint
    FROM demandcom_kpi_cache kc LIMIT 1;
    RETURN;
  END IF;
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

-- 6. Fix get_demandcom_disposition_breakdown: use cache
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
  IF p_activity_filter IS NULL AND p_agent_filter IS NULL THEN
    RETURN QUERY SELECT dc.disposition, dc.count::bigint FROM demandcom_disposition_cache dc;
    RETURN;
  END IF;
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

-- 7. Refresh function for demandcom caches
CREATE OR REPLACE FUNCTION public.refresh_demandcom_caches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '300s'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY demandcom_kpi_cache;
  REFRESH MATERIALIZED VIEW CONCURRENTLY demandcom_disposition_cache;
END;
$$;

-- 8. Extend role timeouts for slow DB
ALTER ROLE authenticated SET statement_timeout = '60s';
ALTER ROLE anon SET statement_timeout = '30s';
