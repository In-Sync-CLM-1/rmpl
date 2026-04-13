-- Rebuild materialized views to use master table instead of demandcom

DROP MATERIALIZED VIEW IF EXISTS master_filter_options_cache CASCADE;
DROP MATERIALIZED VIEW IF EXISTS master_chart_aggregates_cache CASCADE;

CREATE MATERIALIZED VIEW master_filter_options_cache AS
SELECT jsonb_build_object(
  'activity_name', COALESCE((SELECT jsonb_agg(DISTINCT activity_name ORDER BY activity_name) FROM master WHERE activity_name IS NOT NULL AND activity_name != ''), '[]'::jsonb),
  'turnover', COALESCE((SELECT jsonb_agg(DISTINCT turnover ORDER BY turnover) FROM master WHERE turnover IS NOT NULL AND turnover != ''), '[]'::jsonb),
  'emp_size', COALESCE((SELECT jsonb_agg(DISTINCT emp_size ORDER BY emp_size) FROM master WHERE emp_size IS NOT NULL AND emp_size != ''), '[]'::jsonb),
  'industry_type', COALESCE((SELECT jsonb_agg(DISTINCT industry_type ORDER BY industry_type) FROM master WHERE industry_type IS NOT NULL AND industry_type != ''), '[]'::jsonb),
  'sub_industry', COALESCE((SELECT jsonb_agg(DISTINCT sub_industry ORDER BY sub_industry) FROM master WHERE sub_industry IS NOT NULL AND sub_industry != ''), '[]'::jsonb),
  'city', COALESCE((SELECT jsonb_agg(DISTINCT city ORDER BY city) FROM master WHERE city IS NOT NULL AND city != ''), '[]'::jsonb),
  'state', COALESCE((SELECT jsonb_agg(DISTINCT state ORDER BY state) FROM master WHERE state IS NOT NULL AND state != ''), '[]'::jsonb),
  'job_level_updated', COALESCE((SELECT jsonb_agg(DISTINCT job_level_updated ORDER BY job_level_updated) FROM master WHERE job_level_updated IS NOT NULL AND job_level_updated != ''), '[]'::jsonb),
  'deppt', COALESCE((SELECT jsonb_agg(DISTINCT deppt ORDER BY deppt) FROM master WHERE deppt IS NOT NULL AND deppt != ''), '[]'::jsonb)
) as options;
CREATE UNIQUE INDEX ON master_filter_options_cache ((options IS NOT NULL));
GRANT SELECT ON master_filter_options_cache TO anon, authenticated;

CREATE MATERIALIZED VIEW master_chart_aggregates_cache AS
WITH city_agg AS (
  SELECT jsonb_agg(row_to_json(t)) as data FROM (
    SELECT city as name, COUNT(*)::int as value FROM master WHERE city IS NOT NULL AND city != '' GROUP BY city ORDER BY COUNT(*) DESC LIMIT 8
  ) t
),
job_level_agg AS (
  SELECT jsonb_agg(row_to_json(t)) as data FROM (
    SELECT job_level_updated as name, COUNT(*)::int as value FROM master WHERE job_level_updated IS NOT NULL AND job_level_updated != '' GROUP BY job_level_updated ORDER BY COUNT(*) DESC LIMIT 8
  ) t
),
department_agg AS (
  SELECT jsonb_agg(row_to_json(t)) as data FROM (
    SELECT deppt as name, COUNT(*)::int as value FROM master WHERE deppt IS NOT NULL AND deppt != '' GROUP BY deppt ORDER BY COUNT(*) DESC LIMIT 8
  ) t
),
industry_agg AS (
  SELECT jsonb_agg(row_to_json(t)) as data FROM (
    SELECT industry_type as name, COUNT(*)::int as value FROM master WHERE industry_type IS NOT NULL AND industry_type != '' GROUP BY industry_type ORDER BY COUNT(*) DESC LIMIT 8
  ) t
),
turnover_agg AS (
  SELECT jsonb_agg(row_to_json(t)) as data FROM (
    SELECT turnover as name, COUNT(*)::int as value FROM master WHERE turnover IS NOT NULL AND turnover != '' GROUP BY turnover ORDER BY COUNT(*) DESC LIMIT 8
  ) t
),
emp_size_agg AS (
  SELECT jsonb_agg(row_to_json(t)) as data FROM (
    SELECT emp_size as name, COUNT(*)::int as value FROM master WHERE emp_size IS NOT NULL AND emp_size != '' GROUP BY emp_size ORDER BY COUNT(*) DESC LIMIT 8
  ) t
)
SELECT jsonb_build_object(
  'city', COALESCE((SELECT data FROM city_agg), '[]'::jsonb),
  'jobLevel', COALESCE((SELECT data FROM job_level_agg), '[]'::jsonb),
  'department', COALESCE((SELECT data FROM department_agg), '[]'::jsonb),
  'industry', COALESCE((SELECT data FROM industry_agg), '[]'::jsonb),
  'turnover', COALESCE((SELECT data FROM turnover_agg), '[]'::jsonb),
  'empSize', COALESCE((SELECT data FROM emp_size_agg), '[]'::jsonb)
) as aggregates;
CREATE UNIQUE INDEX ON master_chart_aggregates_cache ((aggregates IS NOT NULL));
GRANT SELECT ON master_chart_aggregates_cache TO anon, authenticated;

-- Update get_master_chart_aggregates to query master table
CREATE OR REPLACE FUNCTION public.get_master_chart_aggregates(
  p_activity_names text[] DEFAULT NULL,
  p_turnovers text[] DEFAULT NULL,
  p_emp_sizes text[] DEFAULT NULL,
  p_industry_types text[] DEFAULT NULL,
  p_sub_industries text[] DEFAULT NULL,
  p_cities text[] DEFAULT NULL,
  p_states text[] DEFAULT NULL,
  p_job_levels text[] DEFAULT NULL,
  p_departments text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_activity_names IS NULL AND p_turnovers IS NULL AND p_emp_sizes IS NULL
     AND p_industry_types IS NULL AND p_sub_industries IS NULL AND p_cities IS NULL
     AND p_states IS NULL AND p_job_levels IS NULL AND p_departments IS NULL THEN
    RETURN (SELECT aggregates FROM master_chart_aggregates_cache LIMIT 1);
  END IF;

  WITH filtered_data AS (
    SELECT city, job_level_updated, deppt, industry_type, turnover, emp_size
    FROM master
    WHERE
      (p_activity_names IS NULL OR activity_name = ANY(p_activity_names))
      AND (p_turnovers IS NULL OR turnover = ANY(p_turnovers))
      AND (p_emp_sizes IS NULL OR emp_size = ANY(p_emp_sizes))
      AND (p_industry_types IS NULL OR industry_type = ANY(p_industry_types))
      AND (p_sub_industries IS NULL OR sub_industry = ANY(p_sub_industries))
      AND (p_cities IS NULL OR city = ANY(p_cities))
      AND (p_states IS NULL OR state = ANY(p_states))
      AND (p_job_levels IS NULL OR job_level_updated = ANY(p_job_levels))
      AND (p_departments IS NULL OR deppt = ANY(p_departments))
  ),
  city_agg AS (
    SELECT jsonb_agg(row_to_json(t)) as data FROM (
      SELECT city as name, COUNT(*)::int as value FROM filtered_data WHERE city IS NOT NULL AND city != '' GROUP BY city ORDER BY COUNT(*) DESC LIMIT 8
    ) t
  ),
  job_level_agg AS (
    SELECT jsonb_agg(row_to_json(t)) as data FROM (
      SELECT job_level_updated as name, COUNT(*)::int as value FROM filtered_data WHERE job_level_updated IS NOT NULL AND job_level_updated != '' GROUP BY job_level_updated ORDER BY COUNT(*) DESC LIMIT 8
    ) t
  ),
  department_agg AS (
    SELECT jsonb_agg(row_to_json(t)) as data FROM (
      SELECT deppt as name, COUNT(*)::int as value FROM filtered_data WHERE deppt IS NOT NULL AND deppt != '' GROUP BY deppt ORDER BY COUNT(*) DESC LIMIT 8
    ) t
  ),
  industry_agg AS (
    SELECT jsonb_agg(row_to_json(t)) as data FROM (
      SELECT industry_type as name, COUNT(*)::int as value FROM filtered_data WHERE industry_type IS NOT NULL AND industry_type != '' GROUP BY industry_type ORDER BY COUNT(*) DESC LIMIT 8
    ) t
  ),
  turnover_agg AS (
    SELECT jsonb_agg(row_to_json(t)) as data FROM (
      SELECT turnover as name, COUNT(*)::int as value FROM filtered_data WHERE turnover IS NOT NULL AND turnover != '' GROUP BY turnover ORDER BY COUNT(*) DESC LIMIT 8
    ) t
  ),
  emp_size_agg AS (
    SELECT jsonb_agg(row_to_json(t)) as data FROM (
      SELECT emp_size as name, COUNT(*)::int as value FROM filtered_data WHERE emp_size IS NOT NULL AND emp_size != '' GROUP BY emp_size ORDER BY COUNT(*) DESC LIMIT 8
    ) t
  )
  SELECT jsonb_build_object(
    'city', COALESCE((SELECT data FROM city_agg), '[]'::jsonb),
    'jobLevel', COALESCE((SELECT data FROM job_level_agg), '[]'::jsonb),
    'department', COALESCE((SELECT data FROM department_agg), '[]'::jsonb),
    'industry', COALESCE((SELECT data FROM industry_agg), '[]'::jsonb),
    'turnover', COALESCE((SELECT data FROM turnover_agg), '[]'::jsonb),
    'empSize', COALESCE((SELECT data FROM emp_size_agg), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

SELECT 'DB restore complete' as status;
