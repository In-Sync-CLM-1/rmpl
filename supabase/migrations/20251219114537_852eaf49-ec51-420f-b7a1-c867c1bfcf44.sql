-- Add index on created_by for faster RLS evaluation
CREATE INDEX IF NOT EXISTS idx_demandcom_created_by ON demandcom(created_by);

-- Add composite index for created_by + created_at for faster filtering
CREATE INDEX IF NOT EXISTS idx_demandcom_created_by_created_at ON demandcom(created_by, created_at DESC);

-- Add index on assigned_to for faster RLS evaluation
CREATE INDEX IF NOT EXISTS idx_demandcom_assigned_to ON demandcom(assigned_to);