-- Create client_branches table for multi-branch support
CREATE TABLE IF NOT EXISTS client_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  branch_name TEXT NOT NULL,
  branch_address TEXT,
  gst_number TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_branches_client_id ON client_branches(client_id);

ALTER TABLE client_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_view_client_branches"
  ON client_branches FOR SELECT TO authenticated USING (true);

CREATE POLICY "managers_manage_client_branches"
  ON client_branches FOR ALL
  USING (
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'super_admin')
  );

-- Migrate existing data from clients flat fields into branches
INSERT INTO client_branches (client_id, branch_name, branch_address, gst_number, is_primary)
SELECT id, COALESCE(branch, 'Head Office'), official_address, gst_number, true
FROM clients
WHERE branch IS NOT NULL OR official_address IS NOT NULL OR gst_number IS NOT NULL;
