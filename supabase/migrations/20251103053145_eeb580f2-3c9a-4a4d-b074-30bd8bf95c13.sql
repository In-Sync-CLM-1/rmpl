-- Create project_tasks table
CREATE TABLE project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  description TEXT,
  assigned_to UUID NOT NULL,
  assigned_by UUID NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_status CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

-- Create indexes for better performance
CREATE INDEX idx_project_tasks_project_id ON project_tasks(project_id);
CREATE INDEX idx_project_tasks_assigned_to ON project_tasks(assigned_to);
CREATE INDEX idx_project_tasks_status ON project_tasks(status);
CREATE INDEX idx_project_tasks_due_date ON project_tasks(due_date);

-- Enable RLS
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;

-- SELECT Policy - Users can view tasks assigned to them or in their projects
CREATE POLICY "Users can view their assigned tasks or tasks in their projects"
ON project_tasks
FOR SELECT
USING (
  auth.uid() = assigned_to
  OR
  auth.uid() = assigned_by
  OR
  public.can_access_project(auth.uid(), project_id)
  OR
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'platform_admin'::app_role)
  OR public.has_role(auth.uid(), 'admin_tech'::app_role)
  OR public.has_role(auth.uid(), 'admin_administration'::app_role)
);

-- INSERT Policy - Only project members can create tasks
CREATE POLICY "Project members can create tasks"
ON project_tasks
FOR INSERT
WITH CHECK (
  public.can_access_project(auth.uid(), project_id)
  AND auth.uid() = assigned_by
);

-- UPDATE Policy - Users can update their assigned tasks
CREATE POLICY "Users can update their assigned tasks"
ON project_tasks
FOR UPDATE
USING (
  auth.uid() = assigned_to
  OR
  auth.uid() = assigned_by
  OR
  public.can_access_project(auth.uid(), project_id)
  OR
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'platform_admin'::app_role)
);

-- DELETE Policy - Only assigners and project members can delete tasks
CREATE POLICY "Project members can delete tasks"
ON project_tasks
FOR DELETE
USING (
  auth.uid() = assigned_by
  OR
  public.can_access_project(auth.uid(), project_id)
  OR
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'platform_admin'::app_role)
);

-- Create trigger function for updated_at and completed_at
CREATE OR REPLACE FUNCTION update_project_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_update_project_tasks_updated_at
BEFORE UPDATE ON project_tasks
FOR EACH ROW
EXECUTE FUNCTION update_project_tasks_updated_at();