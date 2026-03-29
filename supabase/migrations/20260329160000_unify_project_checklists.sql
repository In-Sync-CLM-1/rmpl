-- Phase 5: Unify 3 project checklist tables into one with type discriminator

-- 1. Create unified project_checklists table
CREATE TABLE IF NOT EXISTS project_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  checklist_type text NOT NULL CHECK (checklist_type IN ('demandcom', 'digicom', 'livecom')),
  checklist_item text NOT NULL,
  description text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (project_id, checklist_type, checklist_item)
);

-- 2. Create indexes
CREATE INDEX idx_project_checklists_project_id ON project_checklists(project_id);
CREATE INDEX idx_project_checklists_type ON project_checklists(checklist_type);
CREATE INDEX idx_project_checklists_assigned_to ON project_checklists(assigned_to);
CREATE INDEX idx_project_checklists_status ON project_checklists(status);

-- 3. Migrate data from all 3 tables (preserve original IDs)
INSERT INTO project_checklists (id, project_id, checklist_type, checklist_item, description, assigned_to, due_date, status, created_at, updated_at)
SELECT id, project_id, 'demandcom', checklist_item, description, assigned_to, due_date, status, created_at, updated_at
FROM project_demandcom_checklist
ON CONFLICT DO NOTHING;

INSERT INTO project_checklists (id, project_id, checklist_type, checklist_item, description, assigned_to, due_date, status, created_at, updated_at)
SELECT id, project_id, 'digicom', checklist_item, description, assigned_to, due_date, status, created_at, updated_at
FROM project_digicom_checklist
ON CONFLICT DO NOTHING;

INSERT INTO project_checklists (id, project_id, checklist_type, checklist_item, description, assigned_to, due_date, status, created_at, updated_at)
SELECT id, project_id, 'livecom', checklist_item, description, assigned_to, due_date, status, created_at, updated_at
FROM project_livecom_checklist
ON CONFLICT DO NOTHING;

-- 4. Enable RLS
ALTER TABLE project_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_checklists_select" ON project_checklists
  FOR SELECT USING (true);

CREATE POLICY "project_checklists_insert" ON project_checklists
  FOR INSERT WITH CHECK (can_access_project(auth.uid(), project_id));

CREATE POLICY "project_checklists_update" ON project_checklists
  FOR UPDATE USING (can_access_project(auth.uid(), project_id));

-- 5. Trigger for updated_at
CREATE TRIGGER update_project_checklists_timestamp
  BEFORE UPDATE ON project_checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. Drop old tables
DROP TABLE IF EXISTS project_demandcom_checklist CASCADE;
DROP TABLE IF EXISTS project_digicom_checklist CASCADE;
DROP TABLE IF EXISTS project_livecom_checklist CASCADE;
