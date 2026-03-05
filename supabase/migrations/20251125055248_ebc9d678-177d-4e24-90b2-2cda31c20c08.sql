-- Add missing updated_at column to bulk_import_history
ALTER TABLE public.bulk_import_history 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add index on demandcom for better query performance
CREATE INDEX IF NOT EXISTS idx_demandcom_updated_at ON public.demandcom(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_demandcom_assigned_to ON public.demandcom(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_demandcom_latest_disposition ON public.demandcom(latest_disposition) WHERE latest_disposition IS NOT NULL;

-- Add index on master for better query performance
CREATE INDEX IF NOT EXISTS idx_master_updated_at ON public.master(updated_at DESC);

-- Add index on bulk_import_history for status queries
CREATE INDEX IF NOT EXISTS idx_bulk_import_status ON public.bulk_import_history(status, user_id);

-- Add trigger to auto-update updated_at for bulk_import_history
CREATE OR REPLACE FUNCTION update_bulk_import_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_bulk_import_history_updated_at ON public.bulk_import_history;
CREATE TRIGGER set_bulk_import_history_updated_at
  BEFORE UPDATE ON public.bulk_import_history
  FOR EACH ROW
  EXECUTE FUNCTION update_bulk_import_history_updated_at();