-- Drop and recreate the get_demandcom_kpi_metrics function to include proper date filtering
CREATE OR REPLACE FUNCTION public.get_demandcom_kpi_metrics(
  p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_activity_filter text DEFAULT NULL::text, 
  p_agent_filter uuid DEFAULT NULL::uuid, 
  p_today_start timestamp with time zone DEFAULT NULL::timestamp with time zone
)
 RETURNS TABLE(total_count bigint, assigned_count bigint, registered_count bigint, updated_today_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE assigned_to IS NOT NULL) as assigned_count,
    COUNT(*) FILTER (WHERE latest_subdisposition = 'Registered') as registered_count,
    COUNT(*) FILTER (WHERE updated_at >= COALESCE(p_today_start, CURRENT_DATE::timestamptz)) as updated_today_count
  FROM demandcom
  WHERE 
    (p_activity_filter IS NULL OR activity_name = p_activity_filter)
    AND (p_agent_filter IS NULL OR assigned_to = p_agent_filter)
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date);
$function$;

-- Update get_demandcom_activity_stats to accept date parameters
CREATE OR REPLACE FUNCTION public.get_demandcom_activity_stats(
  p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone
)
 RETURNS TABLE(activity_name text, total bigint, interested bigint, registered bigint, latest_created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    activity_name,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE latest_subdisposition = 'Interested') as interested,
    COUNT(*) FILTER (WHERE latest_subdisposition = 'Registered') as registered,
    MAX(created_at) as latest_created_at
  FROM demandcom
  WHERE activity_name IS NOT NULL AND activity_name != ''
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date)
  GROUP BY activity_name
  ORDER BY MAX(created_at) DESC NULLS LAST;
$function$;

-- Update get_demandcom_disposition_breakdown to accept date parameters
CREATE OR REPLACE FUNCTION public.get_demandcom_disposition_breakdown(
  p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_activity_filter text DEFAULT NULL::text, 
  p_agent_filter uuid DEFAULT NULL::uuid
)
 RETURNS TABLE(disposition text, count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    latest_disposition as disposition,
    COUNT(*) as count
  FROM demandcom
  WHERE 
    latest_disposition IS NOT NULL
    AND (p_activity_filter IS NULL OR activity_name = p_activity_filter)
    AND (p_agent_filter IS NULL OR assigned_to = p_agent_filter)
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date)
  GROUP BY latest_disposition
  ORDER BY count DESC;
$function$;