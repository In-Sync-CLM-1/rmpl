-- Fix security warning: Set search_path for generate_project_number function
CREATE OR REPLACE FUNCTION public.generate_project_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
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
    AND project_number ~ '^PRJ-\d+$';
  
  -- Generate new project number with leading zeros (e.g., PRJ-0002)
  new_project_number := 'PRJ-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN new_project_number;
END;
$function$;