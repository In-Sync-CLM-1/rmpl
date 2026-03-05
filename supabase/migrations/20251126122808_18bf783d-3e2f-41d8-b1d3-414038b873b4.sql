-- Add updated_by column to track who last modified demandcom records
ALTER TABLE demandcom 
ADD COLUMN updated_by uuid REFERENCES profiles(id);

-- Create function to automatically set updated_by on record updates
CREATE OR REPLACE FUNCTION update_demandcom_updated_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_by = auth.uid();
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger to call the function on UPDATE
CREATE TRIGGER set_demandcom_updated_by
  BEFORE UPDATE ON demandcom
  FOR EACH ROW
  EXECUTE FUNCTION update_demandcom_updated_by();

-- Add index for performance on updated_by queries
CREATE INDEX idx_demandcom_updated_by ON demandcom(updated_by);

COMMENT ON COLUMN demandcom.updated_by IS 'Tracks which user last updated this record for Data Team reporting';