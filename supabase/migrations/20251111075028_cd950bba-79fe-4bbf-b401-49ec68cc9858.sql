-- Add new fields to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_source TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_value NUMERIC;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS management_fees NUMERIC;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS expected_afactor NUMERIC;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS final_afactor NUMERIC;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_number TEXT UNIQUE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS closed_reason TEXT;

-- Create function to generate sequential project numbers
CREATE OR REPLACE FUNCTION generate_project_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  new_project_number TEXT;
BEGIN
  -- Get the highest existing project number
  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(project_number, '[^0-9]', '', 'g') AS INTEGER)), 0) + 1
  INTO next_number
  FROM projects
  WHERE project_number IS NOT NULL 
    AND project_number ~ '^\d+$';
  
  -- Generate new project number with leading zeros (e.g., PRJ-0001)
  new_project_number := 'PRJ-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN new_project_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;