-- Create RPC function to get execution project stats with demandcom metrics
CREATE OR REPLACE FUNCTION get_execution_project_stats()
RETURNS TABLE (
  project_name text,
  required_participants integer,
  assigned_data bigint,
  interested_count bigint,
  registered_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.project_name,
    COALESCE(p.number_of_attendees, 0)::integer as required_participants,
    COALESCE(d.assigned_data, 0) as assigned_data,
    COALESCE(d.interested_count, 0) as interested_count,
    COALESCE(d.registered_count, 0) as registered_count
  FROM projects p
  LEFT JOIN (
    SELECT 
      activity_name,
      COUNT(*) as assigned_data,
      COUNT(*) FILTER (WHERE latest_subdisposition = 'Interested') as interested_count,
      COUNT(*) FILTER (WHERE latest_subdisposition = 'Registered') as registered_count
    FROM demandcom
    GROUP BY activity_name
  ) d ON d.activity_name = p.project_name
  WHERE p.status = 'execution'
  ORDER BY p.project_name;
$$;