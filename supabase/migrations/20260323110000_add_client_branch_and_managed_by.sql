-- Add branch and managed_by fields to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS branch TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS managed_by UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_clients_managed_by ON clients(managed_by);
CREATE INDEX IF NOT EXISTS idx_clients_branch ON clients(branch);
