-- Voice BI Assistant - Optimized RPC Functions

-- 1. Project Payment Summary
CREATE OR REPLACE FUNCTION get_project_payment_summary(p_project_name text DEFAULT NULL)
RETURNS TABLE (
  project_id uuid,
  project_name text,
  project_number text,
  client_name text,
  total_invoiced numeric,
  total_received numeric,
  total_pending numeric,
  quotation_count bigint,
  payment_count bigint,
  collection_rate numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.id as project_id,
    p.project_name,
    p.project_number,
    COALESCE(pq.client_name, c.company_name) as client_name,
    COALESCE(SUM(pq.amount), 0) as total_invoiced,
    COALESCE(SUM(pq.paid_amount), 0) as total_received,
    COALESCE(SUM(pq.amount - COALESCE(pq.paid_amount, 0)), 0) as total_pending,
    COUNT(DISTINCT pq.id) as quotation_count,
    COUNT(DISTINCT qp.id) as payment_count,
    CASE 
      WHEN COALESCE(SUM(pq.amount), 0) > 0 
      THEN ROUND((COALESCE(SUM(pq.paid_amount), 0) / SUM(pq.amount)) * 100, 2)
      ELSE 0 
    END as collection_rate
  FROM projects p
  LEFT JOIN clients c ON c.id::text = p.client_id::text
  LEFT JOIN project_quotations pq ON pq.project_id = p.id
  LEFT JOIN quotation_payments qp ON qp.quotation_id = pq.id
  WHERE (p_project_name IS NULL OR p.project_name ILIKE '%' || p_project_name || '%')
  GROUP BY p.id, p.project_name, p.project_number, COALESCE(pq.client_name, c.company_name)
  ORDER BY total_pending DESC;
$$;

-- 2. Collection Efficiency with Period Comparison
CREATE OR REPLACE FUNCTION get_collection_efficiency(
  p_start_date date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  period_invoiced numeric,
  period_received numeric,
  efficiency_pct numeric,
  prev_period_invoiced numeric,
  prev_period_received numeric,
  prev_efficiency_pct numeric,
  trend text,
  trend_pct numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH period_days AS (
    SELECT p_end_date - p_start_date AS days
  ),
  current_period AS (
    SELECT 
      COALESCE(SUM(pq.amount), 0) as invoiced,
      COALESCE(SUM(pq.paid_amount), 0) as received
    FROM project_quotations pq
    WHERE pq.created_at::date BETWEEN p_start_date AND p_end_date
  ),
  previous_period AS (
    SELECT 
      COALESCE(SUM(pq.amount), 0) as invoiced,
      COALESCE(SUM(pq.paid_amount), 0) as received
    FROM project_quotations pq
    WHERE pq.created_at::date BETWEEN 
      p_start_date - (SELECT days FROM period_days) AND 
      p_start_date - INTERVAL '1 day'
  )
  SELECT 
    cp.invoiced as period_invoiced,
    cp.received as period_received,
    CASE WHEN cp.invoiced > 0 THEN ROUND((cp.received / cp.invoiced) * 100, 2) ELSE 0 END as efficiency_pct,
    pp.invoiced as prev_period_invoiced,
    pp.received as prev_period_received,
    CASE WHEN pp.invoiced > 0 THEN ROUND((pp.received / pp.invoiced) * 100, 2) ELSE 0 END as prev_efficiency_pct,
    CASE 
      WHEN cp.invoiced = 0 AND pp.invoiced = 0 THEN 'stable'
      WHEN (CASE WHEN cp.invoiced > 0 THEN cp.received / cp.invoiced ELSE 0 END) > 
           (CASE WHEN pp.invoiced > 0 THEN pp.received / pp.invoiced ELSE 0 END) THEN 'up'
      WHEN (CASE WHEN cp.invoiced > 0 THEN cp.received / cp.invoiced ELSE 0 END) < 
           (CASE WHEN pp.invoiced > 0 THEN pp.received / pp.invoiced ELSE 0 END) THEN 'down'
      ELSE 'stable'
    END as trend,
    ROUND(
      (CASE WHEN cp.invoiced > 0 THEN (cp.received / cp.invoiced) * 100 ELSE 0 END) -
      (CASE WHEN pp.invoiced > 0 THEN (pp.received / pp.invoiced) * 100 ELSE 0 END), 2
    ) as trend_pct
  FROM current_period cp, previous_period pp;
$$;

-- 3. Agent Performance with Comparisons
CREATE OR REPLACE FUNCTION get_agent_performance(
  p_agent_name text DEFAULT NULL,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  agent_id uuid,
  agent_name text,
  total_calls bigint,
  connects bigint,
  connect_rate numeric,
  interested bigint,
  registered bigint,
  conversion_rate numeric,
  yesterday_calls bigint,
  vs_yesterday_pct numeric,
  team_avg_calls numeric,
  vs_team_avg_pct numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH agent_today AS (
    SELECT 
      p.id as agent_id,
      p.full_name as agent_name,
      COUNT(DISTINCT cl.id) as total_calls,
      COUNT(DISTINCT cl.id) FILTER (WHERE cl.status = 'completed' AND cl.conversation_duration > 0) as connects,
      COUNT(DISTINCT d.id) FILTER (WHERE d.latest_subdisposition = 'Interested') as interested,
      COUNT(DISTINCT d.id) FILTER (WHERE d.latest_subdisposition = 'Registered') as registered
    FROM profiles p
    LEFT JOIN call_logs cl ON cl.initiated_by = p.id AND cl.created_at::date = p_date
    LEFT JOIN demandcom d ON d.assigned_to = p.id AND d.updated_at::date = p_date
    WHERE (p_agent_name IS NULL OR p.full_name ILIKE '%' || p_agent_name || '%')
    GROUP BY p.id, p.full_name
  ),
  agent_yesterday AS (
    SELECT 
      p.id as agent_id,
      COUNT(DISTINCT cl.id) as calls
    FROM profiles p
    LEFT JOIN call_logs cl ON cl.initiated_by = p.id AND cl.created_at::date = p_date - INTERVAL '1 day'
    GROUP BY p.id
  ),
  team_avg AS (
    SELECT COALESCE(AVG(cnt), 0)::numeric as avg_calls
    FROM (
      SELECT COUNT(*) as cnt 
      FROM call_logs 
      WHERE created_at::date = p_date 
      GROUP BY initiated_by
    ) t
  )
  SELECT 
    at.agent_id,
    at.agent_name,
    at.total_calls,
    at.connects,
    CASE WHEN at.total_calls > 0 THEN ROUND((at.connects::numeric / at.total_calls) * 100, 2) ELSE 0 END as connect_rate,
    at.interested,
    at.registered,
    CASE WHEN at.connects > 0 THEN ROUND((at.registered::numeric / at.connects) * 100, 2) ELSE 0 END as conversion_rate,
    COALESCE(ay.calls, 0) as yesterday_calls,
    CASE WHEN COALESCE(ay.calls, 0) > 0 
      THEN ROUND(((at.total_calls - ay.calls)::numeric / ay.calls) * 100, 2) 
      ELSE 0 
    END as vs_yesterday_pct,
    COALESCE(ta.avg_calls, 0) as team_avg_calls,
    CASE WHEN COALESCE(ta.avg_calls, 0) > 0 
      THEN ROUND(((at.total_calls - ta.avg_calls) / ta.avg_calls) * 100, 2) 
      ELSE 0 
    END as vs_team_avg_pct
  FROM agent_today at
  LEFT JOIN agent_yesterday ay ON ay.agent_id = at.agent_id
  CROSS JOIN team_avg ta
  WHERE at.total_calls > 0 OR at.agent_name IS NOT NULL
  ORDER BY at.total_calls DESC;
$$;

-- 4. Activity-based Registrations (using demandcom activity_name directly)
CREATE OR REPLACE FUNCTION get_activity_registrations(p_activity_name text DEFAULT NULL)
RETURNS TABLE (
  activity_name text,
  total_leads bigint,
  registered bigint,
  today_registered bigint,
  registration_rate numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    d.activity_name,
    COUNT(*) as total_leads,
    COUNT(*) FILTER (WHERE d.latest_subdisposition = 'Registered') as registered,
    COUNT(*) FILTER (WHERE d.latest_subdisposition = 'Registered' AND d.updated_at::date = CURRENT_DATE) as today_registered,
    CASE WHEN COUNT(*) > 0 
      THEN ROUND((COUNT(*) FILTER (WHERE d.latest_subdisposition = 'Registered')::numeric / COUNT(*)) * 100, 2) 
      ELSE 0 
    END as registration_rate
  FROM demandcom d
  WHERE d.activity_name IS NOT NULL 
    AND (p_activity_name IS NULL OR d.activity_name ILIKE '%' || p_activity_name || '%')
  GROUP BY d.activity_name
  ORDER BY registered DESC;
$$;

-- 5. Top Pending Companies
CREATE OR REPLACE FUNCTION get_top_pending_companies(p_limit int DEFAULT 5)
RETURNS TABLE (
  client_id uuid,
  company_name text,
  contact_name text,
  total_pending numeric,
  oldest_pending_days int,
  invoice_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    c.id as client_id,
    c.company_name,
    c.contact_name,
    COALESCE(SUM(pq.amount - COALESCE(pq.paid_amount, 0)), 0) as total_pending,
    COALESCE(
      EXTRACT(DAY FROM NOW() - MIN(pq.created_at))::int, 
      0
    ) as oldest_pending_days,
    COUNT(DISTINCT pq.id) as invoice_count
  FROM clients c
  JOIN projects p ON p.client_id::text = c.id::text
  JOIN project_quotations pq ON pq.project_id = p.id
  WHERE pq.amount > COALESCE(pq.paid_amount, 0)
  GROUP BY c.id, c.company_name, c.contact_name
  HAVING SUM(pq.amount - COALESCE(pq.paid_amount, 0)) > 0
  ORDER BY total_pending DESC
  LIMIT p_limit;
$$;

-- 6. Dashboard Overview for Voice BI
CREATE OR REPLACE FUNCTION get_voice_bi_overview()
RETURNS TABLE (
  total_projects bigint,
  active_projects bigint,
  total_invoiced numeric,
  total_received numeric,
  total_pending numeric,
  collection_rate numeric,
  today_calls bigint,
  today_registrations bigint,
  agents_active bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH project_stats AS (
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'active') as active
    FROM projects
  ),
  payment_stats AS (
    SELECT 
      COALESCE(SUM(amount), 0) as invoiced,
      COALESCE(SUM(paid_amount), 0) as received
    FROM project_quotations
  ),
  today_activity AS (
    SELECT 
      (SELECT COUNT(*) FROM call_logs WHERE created_at::date = CURRENT_DATE) as calls,
      (SELECT COUNT(*) FROM demandcom WHERE latest_subdisposition = 'Registered' AND updated_at::date = CURRENT_DATE) as registrations,
      (SELECT COUNT(DISTINCT initiated_by) FROM call_logs WHERE created_at::date = CURRENT_DATE) as agents
  )
  SELECT 
    ps.total as total_projects,
    ps.active as active_projects,
    pmt.invoiced as total_invoiced,
    pmt.received as total_received,
    pmt.invoiced - pmt.received as total_pending,
    CASE WHEN pmt.invoiced > 0 THEN ROUND((pmt.received / pmt.invoiced) * 100, 2) ELSE 0 END as collection_rate,
    ta.calls as today_calls,
    ta.registrations as today_registrations,
    ta.agents as agents_active
  FROM project_stats ps, payment_stats pmt, today_activity ta;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_project_payment_summary(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_collection_efficiency(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_agent_performance(text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_activity_registrations(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_pending_companies(int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_voice_bi_overview() TO authenticated;