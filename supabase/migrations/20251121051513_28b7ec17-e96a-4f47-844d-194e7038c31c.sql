-- Create project_demandcom_checklist table
CREATE TABLE project_demandcom_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  checklist_item TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, checklist_item)
);

-- Create index for better query performance
CREATE INDEX idx_project_demandcom_project_id ON project_demandcom_checklist(project_id);

-- Enable RLS
ALTER TABLE project_demandcom_checklist ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view demandcom checklist for accessible projects"
  ON project_demandcom_checklist FOR SELECT
  USING (can_access_project(auth.uid(), project_id));

CREATE POLICY "Users can update demandcom checklist for accessible projects"
  ON project_demandcom_checklist FOR UPDATE
  USING (can_access_project(auth.uid(), project_id));

CREATE POLICY "Users can insert demandcom checklist for accessible projects"
  ON project_demandcom_checklist FOR INSERT
  WITH CHECK (can_access_project(auth.uid(), project_id));

-- Trigger for updated_at
CREATE TRIGGER update_project_demandcom_timestamp
  BEFORE UPDATE ON project_demandcom_checklist
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();