-- Create helper function to fetch creator names (bypasses RLS)
CREATE OR REPLACE FUNCTION get_project_creator_name(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT full_name FROM profiles WHERE id = _user_id;
$$;