-- Create table to track field-level changes in demandcom
CREATE TABLE IF NOT EXISTS public.demandcom_field_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demandcom_id UUID NOT NULL REFERENCES public.demandcom(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES public.profiles(id),
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_demandcom_field_changes_changed_by 
  ON public.demandcom_field_changes(changed_by);
CREATE INDEX IF NOT EXISTS idx_demandcom_field_changes_changed_at 
  ON public.demandcom_field_changes(changed_at);
CREATE INDEX IF NOT EXISTS idx_demandcom_field_changes_demandcom_id 
  ON public.demandcom_field_changes(demandcom_id);

-- Enable RLS
ALTER TABLE public.demandcom_field_changes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view field changes"
  ON public.demandcom_field_changes
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Create trigger function to log field changes
CREATE OR REPLACE FUNCTION public.log_demandcom_field_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_by_id UUID;
BEGIN
  -- Get the user who made the change
  changed_by_id := NEW.updated_by;
  
  -- Track disposition changes
  IF OLD.latest_disposition IS DISTINCT FROM NEW.latest_disposition THEN
    INSERT INTO public.demandcom_field_changes (demandcom_id, changed_by, changed_at, field_name, old_value, new_value)
    VALUES (NEW.id, changed_by_id, NEW.updated_at, 'disposition', OLD.latest_disposition, NEW.latest_disposition);
  END IF;
  
  -- Track company name changes
  IF OLD.company_name IS DISTINCT FROM NEW.company_name THEN
    INSERT INTO public.demandcom_field_changes (demandcom_id, changed_by, changed_at, field_name, old_value, new_value)
    VALUES (NEW.id, changed_by_id, NEW.updated_at, 'company_name', OLD.company_name, NEW.company_name);
  END IF;
  
  -- Track contact name changes
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    INSERT INTO public.demandcom_field_changes (demandcom_id, changed_by, changed_at, field_name, old_value, new_value)
    VALUES (NEW.id, changed_by_id, NEW.updated_at, 'name', OLD.name, NEW.name);
  END IF;
  
  -- Track mobile number changes
  IF OLD.mobile_numb IS DISTINCT FROM NEW.mobile_numb THEN
    INSERT INTO public.demandcom_field_changes (demandcom_id, changed_by, changed_at, field_name, old_value, new_value)
    VALUES (NEW.id, changed_by_id, NEW.updated_at, 'mobile_numb', OLD.mobile_numb, NEW.mobile_numb);
  END IF;
  
  -- Track official email changes
  IF OLD.official IS DISTINCT FROM NEW.official THEN
    INSERT INTO public.demandcom_field_changes (demandcom_id, changed_by, changed_at, field_name, old_value, new_value)
    VALUES (NEW.id, changed_by_id, NEW.updated_at, 'official', OLD.official, NEW.official);
  END IF;
  
  -- Track city changes
  IF OLD.city IS DISTINCT FROM NEW.city THEN
    INSERT INTO public.demandcom_field_changes (demandcom_id, changed_by, changed_at, field_name, old_value, new_value)
    VALUES (NEW.id, changed_by_id, NEW.updated_at, 'city', OLD.city, NEW.city);
  END IF;
  
  -- Track state changes
  IF OLD.state IS DISTINCT FROM NEW.state THEN
    INSERT INTO public.demandcom_field_changes (demandcom_id, changed_by, changed_at, field_name, old_value, new_value)
    VALUES (NEW.id, changed_by_id, NEW.updated_at, 'state', OLD.state, NEW.state);
  END IF;
  
  -- Track address changes
  IF OLD.address IS DISTINCT FROM NEW.address THEN
    INSERT INTO public.demandcom_field_changes (demandcom_id, changed_by, changed_at, field_name, old_value, new_value)
    VALUES (NEW.id, changed_by_id, NEW.updated_at, 'address', OLD.address, NEW.address);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on demandcom table
DROP TRIGGER IF EXISTS track_demandcom_field_changes ON public.demandcom;
CREATE TRIGGER track_demandcom_field_changes
  AFTER UPDATE ON public.demandcom
  FOR EACH ROW
  EXECUTE FUNCTION public.log_demandcom_field_changes();