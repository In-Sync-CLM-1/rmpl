-- Fix generate_project_number function to correctly identify existing project numbers
CREATE OR REPLACE FUNCTION public.generate_project_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  next_number INTEGER;
  new_project_number TEXT;
BEGIN
  -- Get the highest existing project number
  -- Extract numeric part from project numbers like "PRJ-0001"
  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(project_number, '[^0-9]', '', 'g') AS INTEGER)), 0) + 1
  INTO next_number
  FROM projects
  WHERE project_number IS NOT NULL 
    AND project_number ~ '^PRJ-\d+$';  -- Match actual format "PRJ-####" instead of just digits
  
  -- Generate new project number with leading zeros (e.g., PRJ-0002)
  new_project_number := 'PRJ-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN new_project_number;
END;
$function$;