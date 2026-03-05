
-- Create function to get demandcom KPI metrics (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_demandcom_kpi_metrics(
  p_activity_filter text DEFAULT NULL,
  p_agent_filter uuid DEFAULT NULL,
  p_today_start timestamptz DEFAULT NULL
)
RETURNS TABLE (
  total_count bigint,
  assigned_count bigint,
  registered_count bigint,
  updated_today_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE assigned_to IS NOT NULL) as assigned_count,
    COUNT(*) FILTER (WHERE latest_subdisposition = 'Registered') as registered_count,
    COUNT(*) FILTER (WHERE updated_at >= COALESCE(p_today_start, CURRENT_DATE::timestamptz)) as updated_today_count
  FROM demandcom
  WHERE 
    (p_activity_filter IS NULL OR activity_name = p_activity_filter)
    AND (p_agent_filter IS NULL OR assigned_to = p_agent_filter);
$$;

-- Create function to get disposition breakdown (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_demandcom_disposition_breakdown(
  p_activity_filter text DEFAULT NULL,
  p_agent_filter uuid DEFAULT NULL
)
RETURNS TABLE (
  disposition text,
  count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    latest_disposition as disposition,
    COUNT(*) as count
  FROM demandcom
  WHERE 
    latest_disposition IS NOT NULL
    AND (p_activity_filter IS NULL OR activity_name = p_activity_filter)
    AND (p_agent_filter IS NULL OR assigned_to = p_agent_filter)
  GROUP BY latest_disposition
  ORDER BY count DESC;
$$;

-- Create function to get agent performance stats (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_demandcom_agent_stats(
  p_team_name text DEFAULT 'Demandcom-Calling'
)
RETURNS TABLE (
  agent_id uuid,
  agent_name text,
  total_assigned bigint,
  tagged_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH team_agents AS (
    SELECT DISTINCT tm.user_id
    FROM team_members tm
    JOIN teams t ON t.id = tm.team_id
    WHERE t.name = p_team_name
  ),
  agent_profiles AS (
    SELECT p.id, p.full_name
    FROM profiles p
    WHERE p.id IN (SELECT user_id FROM team_agents)
  )
  SELECT 
    ap.id as agent_id,
    ap.full_name as agent_name,
    COUNT(d.id) as total_assigned,
    COUNT(d.id) FILTER (WHERE d.latest_disposition IS NOT NULL) as tagged_count
  FROM agent_profiles ap
  LEFT JOIN demandcom d ON d.assigned_to = ap.id
  GROUP BY ap.id, ap.full_name
  ORDER BY COUNT(d.id) DESC;
$$;
