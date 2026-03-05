-- Add next_call_date column to demandcom table
ALTER TABLE demandcom ADD COLUMN IF NOT EXISTS next_call_date TIMESTAMP WITH TIME ZONE;

-- Update the trigger to only fire for non-empty dispositions
CREATE OR REPLACE FUNCTION public.update_demandcom_latest_disposition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only update if disposition was set AND is not an empty string
  IF NEW.disposition IS NOT NULL AND NEW.disposition != '' THEN
    UPDATE demandcom
    SET 
      latest_disposition = NEW.disposition,
      latest_subdisposition = NEW.subdisposition,
      last_call_date = NEW.disposition_set_at
    WHERE id = NEW.demandcom_id;
  END IF;
  
  RETURN NEW;
END;
$function$;