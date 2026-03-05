-- Update generate_project_number function to use RMPL-YY-N format
-- Format: RMPL-25-1, RMPL-25-2, etc. (resets each year)

CREATE OR REPLACE FUNCTION public.generate_project_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_year TEXT;
  next_number INTEGER;
  new_project_number TEXT;
BEGIN
  -- Get current 2-digit year (e.g., '25' for 2025)
  current_year := TO_CHAR(CURRENT_DATE, 'YY');
  
  -- Get the highest existing sequence number for current year
  -- Extract numeric part after last hyphen from project numbers like "RMPL-25-1"
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(
        project_number 
        FROM 'RMPL-' || current_year || '-(\d+)$'
      ) AS INTEGER
    )
  ), 0) + 1
  INTO next_number
  FROM projects
  WHERE project_number ~ ('^RMPL-' || current_year || '-\d+$');
  
  -- Generate new project number with format RMPL-YY-N
  new_project_number := 'RMPL-' || current_year || '-' || next_number::TEXT;
  
  RETURN new_project_number;
END;
$function$;