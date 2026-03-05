-- Fix the search_path syntax for the function
CREATE OR REPLACE FUNCTION update_demandcom_latest_disposition()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only update if disposition was set
  IF NEW.disposition IS NOT NULL THEN
    UPDATE demandcom
    SET 
      latest_disposition = NEW.disposition,
      latest_subdisposition = NEW.subdisposition,
      last_call_date = NEW.disposition_set_at
    WHERE id = NEW.demandcom_id;
  END IF;
  
  RETURN NEW;
END;
$$;