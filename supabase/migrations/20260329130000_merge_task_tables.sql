-- Phase 2: Merge general_tasks and project_tasks into unified tasks table

-- 1. Create unified tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  task_name text NOT NULL,
  description text,
  assigned_to uuid NOT NULL REFERENCES auth.users(id),
  assigned_by uuid NOT NULL REFERENCES auth.users(id),
  due_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  parent_task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  completed_at timestamptz,
  completion_notes text,
  completion_file_path text,
  completion_file_name text,
  completion_files json,
  restart_reason text,
  restarted_at timestamptz,
  restarted_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX idx_tasks_project_id ON tasks (project_id);
CREATE INDEX idx_tasks_assigned_to ON tasks (assigned_to);
CREATE INDEX idx_tasks_assigned_by ON tasks (assigned_by);
CREATE INDEX idx_tasks_status ON tasks (status);
CREATE INDEX idx_tasks_due_date ON tasks (due_date);
CREATE INDEX idx_tasks_parent_id ON tasks (parent_task_id);
CREATE INDEX idx_tasks_created_at ON tasks (created_at DESC);

-- 3. Migrate data from general_tasks (project_id = NULL)
INSERT INTO tasks (
  id, project_id, task_name, description, assigned_to, assigned_by,
  due_date, status, priority, parent_task_id, completed_at,
  completion_notes, completion_file_path, completion_file_name, completion_files,
  restart_reason, restarted_at, restarted_by, created_at, updated_at
)
SELECT
  id, NULL, task_name, description, assigned_to, assigned_by,
  due_date, status, priority, parent_task_id, completed_at,
  completion_notes, completion_file_path, completion_file_name, completion_files,
  restart_reason, restarted_at, restarted_by, created_at, updated_at
FROM general_tasks;

-- 4. Migrate data from project_tasks
INSERT INTO tasks (
  id, project_id, task_name, description, assigned_to, assigned_by,
  due_date, status, priority, parent_task_id, completed_at,
  completion_notes, completion_file_path, completion_file_name, completion_files,
  restart_reason, restarted_at, restarted_by, created_at, updated_at
)
SELECT
  id, project_id, task_name, description, assigned_to, assigned_by,
  due_date, status, priority, parent_task_id, completed_at,
  completion_notes, completion_file_path, completion_file_name, completion_files,
  restart_reason, restarted_at, restarted_by, created_at, updated_at
FROM project_tasks;

-- 5. Update chat_messages: merge project_task_id into task_id
-- First drop FKs on chat_messages
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_task_id_fkey;
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_project_task_id_fkey;

-- Merge: where project_task_id has value and task_id is null, move it
UPDATE chat_messages SET task_id = project_task_id WHERE project_task_id IS NOT NULL AND task_id IS NULL;

-- Drop the project_task_id column
ALTER TABLE chat_messages DROP COLUMN IF EXISTS project_task_id;

-- Add new FK to unified tasks table
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;

-- 6. Update notifications: merge general_task_id into task_id
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_task_id_fkey;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_general_task_id_fkey;

-- Merge: where general_task_id has value and task_id is null, move it
UPDATE notifications SET task_id = general_task_id WHERE general_task_id IS NOT NULL AND task_id IS NULL;

-- Drop the general_task_id column
ALTER TABLE notifications DROP COLUMN IF EXISTS general_task_id;

-- Add new FK to unified tasks table
ALTER TABLE notifications ADD CONSTRAINT notifications_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;

-- 7. RLS policies for tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tasks assigned to/by them or in their projects"
  ON tasks FOR SELECT USING (
    auth.uid() = assigned_to
    OR auth.uid() = assigned_by
    OR (project_id IS NOT NULL AND can_access_project(auth.uid(), project_id))
    OR is_admin_user(auth.uid())
    OR has_role(auth.uid(), 'admin_tech'::app_role)
    OR has_role(auth.uid(), 'admin_administration'::app_role)
  );

CREATE POLICY "Authenticated users can create tasks"
  ON tasks FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update tasks assigned to/by them"
  ON tasks FOR UPDATE USING (
    auth.uid() = assigned_to
    OR auth.uid() = assigned_by
    OR (project_id IS NOT NULL AND can_access_project(auth.uid(), project_id))
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'platform_admin'::app_role)
  );

CREATE POLICY "Users can delete tasks they created"
  ON tasks FOR DELETE USING (
    auth.uid() = assigned_by
    OR (project_id IS NOT NULL AND can_access_project(auth.uid(), project_id))
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'platform_admin'::app_role)
  );

-- 8. Unified trigger for updated_at + completed_at
CREATE OR REPLACE FUNCTION update_tasks_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tasks_timestamps_trigger
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_tasks_timestamps();

-- 9. Unified notification trigger
CREATE OR REPLACE FUNCTION notify_task_assignment_unified()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.assigned_by THEN
      INSERT INTO public.notifications (
        user_id, task_id, notification_type, title, message
      ) VALUES (
        NEW.assigned_to, NEW.id, 'task_assigned',
        'New Task Assigned',
        'You have been assigned a new task: ' || NEW.task_name
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER task_assignment_notification_trigger
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION notify_task_assignment_unified();

-- 10. Points trigger (re-attach from general_tasks)
CREATE TRIGGER after_task_status_update_trigger
  AFTER UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION trigger_task_completion_points();

-- 11. Update get_digicom_dashboard RPC to use unified tasks table
CREATE OR REPLACE FUNCTION get_digicom_dashboard(p_start_date date, p_end_date date)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_team_id UUID;
  v_member_ids UUID[];
  v_result JSON;
BEGIN
  SELECT id INTO v_team_id FROM teams WHERE name = 'Digicom' AND is_active = true LIMIT 1;
  IF v_team_id IS NULL THEN
    RETURN '{"members":[],"team_summary":{},"weekly_trend":[]}'::JSON;
  END IF;

  SELECT ARRAY_AGG(user_id) INTO v_member_ids
  FROM team_members WHERE team_id = v_team_id AND is_active = true;

  IF v_member_ids IS NULL OR array_length(v_member_ids, 1) IS NULL THEN
    RETURN '{"members":[],"team_summary":{},"weekly_trend":[]}'::JSON;
  END IF;

  WITH all_tasks AS (
    SELECT id, task_name, assigned_to, assigned_by, due_date, status, priority,
           created_at, completed_at,
           CASE WHEN project_id IS NULL THEN 'general' ELSE 'project' END as task_type,
           project_id
    FROM tasks
    WHERE assigned_to = ANY(v_member_ids)
      AND created_at::date <= p_end_date
      AND (completed_at IS NULL OR completed_at::date >= p_start_date)
      AND (due_date::date >= p_start_date OR status != 'completed')
  ),
  member_stats AS (
    SELECT
      t.assigned_to as user_id,
      p.full_name,
      COUNT(*) as total_tasks,
      COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed,
      COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress,
      COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending,
      COUNT(CASE WHEN t.status = 'cancelled' THEN 1 END) as cancelled,
      COUNT(CASE WHEN t.status != 'completed' AND t.status != 'cancelled' AND t.due_date::date < CURRENT_DATE THEN 1 END) as overdue,
      COUNT(CASE WHEN t.status = 'completed' AND t.completed_at::date <= t.due_date::date THEN 1 END) as on_time,
      COUNT(CASE WHEN t.task_type = 'general' THEN 1 END) as general_tasks,
      COUNT(CASE WHEN t.task_type = 'project' THEN 1 END) as project_tasks,
      COUNT(CASE WHEN t.priority = 'urgent' OR t.priority = 'high' THEN 1 END) as high_priority,
      ROUND(AVG(CASE WHEN t.status = 'completed' AND t.completed_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (t.completed_at - t.created_at)) / 86400.0
        ELSE NULL END)::numeric, 1) as avg_completion_days
    FROM all_tasks t
    JOIN profiles p ON p.id = t.assigned_to
    GROUP BY t.assigned_to, p.full_name
  ),
  team_totals AS (
    SELECT
      COUNT(*) as total_tasks,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
      COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
      COUNT(CASE WHEN status != 'completed' AND status != 'cancelled' AND due_date::date < CURRENT_DATE THEN 1 END) as overdue,
      COUNT(CASE WHEN task_type = 'general' THEN 1 END) as general_tasks,
      COUNT(CASE WHEN task_type = 'project' THEN 1 END) as project_tasks
    FROM all_tasks
  ),
  weekly_data AS (
    SELECT
      DATE_TRUNC('week', COALESCE(completed_at, created_at))::date as week_start,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
      COUNT(*) as created
    FROM all_tasks
    WHERE COALESCE(completed_at, created_at)::date BETWEEN p_start_date AND p_end_date
    GROUP BY DATE_TRUNC('week', COALESCE(completed_at, created_at))
    ORDER BY week_start
  )
  SELECT json_build_object(
    'members', COALESCE((SELECT json_agg(row_to_json(ms) ORDER BY ms.completed DESC) FROM member_stats ms), '[]'::json),
    'team_summary', COALESCE((SELECT row_to_json(tt) FROM team_totals tt), '{}'::json),
    'weekly_trend', COALESCE((SELECT json_agg(row_to_json(wd) ORDER BY wd.week_start) FROM weekly_data wd), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 12. Drop old triggers (from old tables)
DROP TRIGGER IF EXISTS update_general_tasks_updated_at ON general_tasks;
DROP TRIGGER IF EXISTS update_general_tasks_status ON general_tasks;
DROP TRIGGER IF EXISTS notify_general_task_assignment_trigger ON general_tasks;
DROP TRIGGER IF EXISTS after_task_status_update ON general_tasks;
DROP TRIGGER IF EXISTS trigger_update_project_tasks_updated_at ON project_tasks;
DROP TRIGGER IF EXISTS task_assignment_notification ON project_tasks;
DROP TRIGGER IF EXISTS send_task_assignment_email_trigger ON project_tasks;

-- 13. Drop old tables
DROP TABLE IF EXISTS general_tasks CASCADE;
DROP TABLE IF EXISTS project_tasks CASCADE;
