-- Update the get_execution_project_stats function to use registration_target from allocations
CREATE OR REPLACE FUNCTION public.get_execution_project_stats()
RETURNS TABLE(
  project_name TEXT,
  required_participants INTEGER,
  assigned_data BIGINT,
  interested_count BIGINT,
  registered_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    d.activity_name as project_name,
    COALESCE(
      (SELECT SUM(pda.registration_target)::integer 
       FROM project_demandcom_allocations pda 
       WHERE pda.project_id = p.id),
      p.number_of_attendees,
      0
    )::integer as required_participants,
    COUNT(*) as assigned_data,
    COUNT(*) FILTER (WHERE d.latest_subdisposition = 'Interested') as interested_count,
    COUNT(*) FILTER (WHERE d.latest_subdisposition = 'Registered') as registered_count
  FROM demandcom d
  LEFT JOIN projects p ON p.project_name = d.activity_name
  WHERE d.activity_name IS NOT NULL
  GROUP BY d.activity_name, p.id, p.number_of_attendees
  ORDER BY COUNT(*) DESC;
$$;