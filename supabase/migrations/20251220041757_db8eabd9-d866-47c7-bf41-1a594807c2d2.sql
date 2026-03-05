-- Update RPC function to only return activities that exist in demandcom table
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
    d.activity_name as project_name,
    COALESCE(p.number_of_attendees, 0)::integer as required_participants,
    COUNT(*) as assigned_data,
    COUNT(*) FILTER (WHERE d.latest_subdisposition = 'Interested') as interested_count,
    COUNT(*) FILTER (WHERE d.latest_subdisposition = 'Registered') as registered_count
  FROM demandcom d
  LEFT JOIN projects p ON p.project_name = d.activity_name
  WHERE d.activity_name IS NOT NULL
  GROUP BY d.activity_name, p.number_of_attendees
  ORDER BY COUNT(*) DESC;
$$;