-- Add campaign_type column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS campaign_type text DEFAULT 'offline';

-- Create demandcom_daily_targets table
CREATE TABLE IF NOT EXISTS demandcom_daily_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_date date NOT NULL,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  set_by uuid REFERENCES profiles(id),
  call_target integer DEFAULT 0,
  registration_target integer DEFAULT 0,
  campaign_type text NOT NULL CHECK (campaign_type IN ('online', 'offline')),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(target_date, user_id, campaign_type)
);

-- Enable RLS
ALTER TABLE demandcom_daily_targets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own targets or targets of their direct reports
CREATE POLICY "Users can view own and subordinate targets"
ON demandcom_daily_targets FOR SELECT
USING (
  user_id = auth.uid() 
  OR set_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles WHERE id = demandcom_daily_targets.user_id AND reports_to = auth.uid()
  )
  OR is_admin_user(auth.uid())
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- Policy: Team Leaders can set targets for their direct reports, Managers/Admins for anyone
CREATE POLICY "Team Leaders and Managers can insert targets"
ON demandcom_daily_targets FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = demandcom_daily_targets.user_id AND reports_to = auth.uid()
  )
  OR is_admin_user(auth.uid())
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- Policy: Team Leaders can update targets for their direct reports, Managers/Admins for anyone
CREATE POLICY "Team Leaders and Managers can update targets"
ON demandcom_daily_targets FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = demandcom_daily_targets.user_id AND reports_to = auth.uid()
  )
  OR is_admin_user(auth.uid())
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- Policy: Only Admins can delete targets
CREATE POLICY "Admins can delete targets"
ON demandcom_daily_targets FOR DELETE
USING (is_admin_user(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_demandcom_daily_targets_updated_at
BEFORE UPDATE ON demandcom_daily_targets
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();