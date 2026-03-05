-- Add the new field requested by user
ALTER TABLE demandcom ADD COLUMN IF NOT EXISTS activity_name text;

-- Add disposition tracking fields (auto-populated from call logs)
ALTER TABLE demandcom ADD COLUMN IF NOT EXISTS latest_disposition text;
ALTER TABLE demandcom ADD COLUMN IF NOT EXISTS latest_subdisposition text;
ALTER TABLE demandcom ADD COLUMN IF NOT EXISTS last_call_date timestamptz;

-- Make name and mobile_numb optional for flexibility
ALTER TABLE demandcom ALTER COLUMN name DROP NOT NULL;
ALTER TABLE demandcom ALTER COLUMN mobile_numb DROP NOT NULL;

-- Create an index for efficient disposition lookups
CREATE INDEX IF NOT EXISTS idx_call_logs_demandcom_date 
ON call_logs(demandcom_id, disposition_set_at DESC);

-- Create a database function to update latest disposition
CREATE OR REPLACE FUNCTION update_demandcom_latest_disposition()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-update disposition on call logs
DROP TRIGGER IF EXISTS trigger_update_disposition ON call_logs;
CREATE TRIGGER trigger_update_disposition
  AFTER INSERT OR UPDATE OF disposition, subdisposition
  ON call_logs
  FOR EACH ROW
  WHEN (NEW.disposition IS NOT NULL)
  EXECUTE FUNCTION update_demandcom_latest_disposition();