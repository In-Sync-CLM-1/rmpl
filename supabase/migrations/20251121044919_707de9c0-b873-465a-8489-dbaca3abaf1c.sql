-- Create project_digicom_checklist table
CREATE TABLE project_digicom_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  checklist_item TEXT NOT NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, checklist_item)
);

-- Add index for better query performance
CREATE INDEX idx_project_digicom_project_id ON project_digicom_checklist(project_id);

-- Enable RLS
ALTER TABLE project_digicom_checklist ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view digicom checklist for accessible projects"
  ON project_digicom_checklist FOR SELECT
  USING (can_access_project(auth.uid(), project_id));

CREATE POLICY "Users can update digicom checklist for accessible projects"
  ON project_digicom_checklist FOR UPDATE
  USING (can_access_project(auth.uid(), project_id));

CREATE POLICY "Users can insert digicom checklist for accessible projects"
  ON project_digicom_checklist FOR INSERT
  WITH CHECK (can_access_project(auth.uid(), project_id));

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_project_digicom_timestamp
  BEFORE UPDATE ON project_digicom_checklist
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();