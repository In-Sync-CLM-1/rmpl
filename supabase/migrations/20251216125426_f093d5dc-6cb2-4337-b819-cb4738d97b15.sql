-- Create function to aggregate master data for charts at database level
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
AS $$
DECLARE
  v_result jsonb;
BEGIN
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
      SELECT city as name, COUNT(*) as value
      FROM filtered_data
      WHERE city IS NOT NULL AND city != ''
      GROUP BY city
      ORDER BY COUNT(*) DESC
      LIMIT 8
    ) t
  ),
  job_level_agg AS (
    SELECT jsonb_agg(row_to_json(t)) as data FROM (
      SELECT job_level_updated as name, COUNT(*) as value
      FROM filtered_data
      WHERE job_level_updated IS NOT NULL AND job_level_updated != ''
      GROUP BY job_level_updated
      ORDER BY COUNT(*) DESC
      LIMIT 8
    ) t
  ),
  department_agg AS (
    SELECT jsonb_agg(row_to_json(t)) as data FROM (
      SELECT deppt as name, COUNT(*) as value
      FROM filtered_data
      WHERE deppt IS NOT NULL AND deppt != ''
      GROUP BY deppt
      ORDER BY COUNT(*) DESC
      LIMIT 8
    ) t
  ),
  industry_agg AS (
    SELECT jsonb_agg(row_to_json(t)) as data FROM (
      SELECT industry_type as name, COUNT(*) as value
      FROM filtered_data
      WHERE industry_type IS NOT NULL AND industry_type != ''
      GROUP BY industry_type
      ORDER BY COUNT(*) DESC
      LIMIT 8
    ) t
  ),
  turnover_agg AS (
    SELECT jsonb_agg(row_to_json(t)) as data FROM (
      SELECT turnover as name, COUNT(*) as value
      FROM filtered_data
      WHERE turnover IS NOT NULL AND turnover != ''
      GROUP BY turnover
      ORDER BY COUNT(*) DESC
      LIMIT 8
    ) t
  ),
  emp_size_agg AS (
    SELECT jsonb_agg(row_to_json(t)) as data FROM (
      SELECT emp_size as name, COUNT(*) as value
      FROM filtered_data
      WHERE emp_size IS NOT NULL AND emp_size != ''
      GROUP BY emp_size
      ORDER BY COUNT(*) DESC
      LIMIT 8
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