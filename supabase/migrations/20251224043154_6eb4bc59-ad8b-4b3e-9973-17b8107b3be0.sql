-- Create function to get all distinct filter options for Master page
-- This bypasses the 1000 row limit by using SQL aggregation
CREATE OR REPLACE FUNCTION get_master_filter_options()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'activity_name', (SELECT COALESCE(jsonb_agg(DISTINCT activity_name ORDER BY activity_name), '[]'::jsonb) FROM master WHERE activity_name IS NOT NULL),
    'turnover', (SELECT COALESCE(jsonb_agg(DISTINCT turnover ORDER BY turnover), '[]'::jsonb) FROM master WHERE turnover IS NOT NULL),
    'emp_size', (SELECT COALESCE(jsonb_agg(DISTINCT emp_size ORDER BY emp_size), '[]'::jsonb) FROM master WHERE emp_size IS NOT NULL),
    'industry_type', (SELECT COALESCE(jsonb_agg(DISTINCT industry_type ORDER BY industry_type), '[]'::jsonb) FROM master WHERE industry_type IS NOT NULL),
    'sub_industry', (SELECT COALESCE(jsonb_agg(DISTINCT sub_industry ORDER BY sub_industry), '[]'::jsonb) FROM master WHERE sub_industry IS NOT NULL),
    'city', (SELECT COALESCE(jsonb_agg(DISTINCT city ORDER BY city), '[]'::jsonb) FROM master WHERE city IS NOT NULL),
    'state', (SELECT COALESCE(jsonb_agg(DISTINCT state ORDER BY state), '[]'::jsonb) FROM master WHERE state IS NOT NULL),
    'job_level_updated', (SELECT COALESCE(jsonb_agg(DISTINCT job_level_updated ORDER BY job_level_updated), '[]'::jsonb) FROM master WHERE job_level_updated IS NOT NULL),
    'deppt', (SELECT COALESCE(jsonb_agg(DISTINCT deppt ORDER BY deppt), '[]'::jsonb) FROM master WHERE deppt IS NOT NULL)
  );
END;
$$;