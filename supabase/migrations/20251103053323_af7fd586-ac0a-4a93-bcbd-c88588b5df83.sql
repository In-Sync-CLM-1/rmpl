-- Add foreign key constraints for project_tasks to profiles
-- This enables proper joins in queries

ALTER TABLE project_tasks
ADD CONSTRAINT project_tasks_assigned_to_fkey
FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE project_tasks
ADD CONSTRAINT project_tasks_assigned_by_fkey
FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE CASCADE;