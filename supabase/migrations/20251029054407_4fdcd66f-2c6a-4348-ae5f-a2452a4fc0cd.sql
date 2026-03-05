-- Enable RLS on the backup table created in previous migration
ALTER TABLE demandcom_backup_swap_20250129 ENABLE ROW LEVEL SECURITY;

-- Create policy to allow admins to view the backup
CREATE POLICY "Admins can view backup data"
ON demandcom_backup_swap_20250129
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);