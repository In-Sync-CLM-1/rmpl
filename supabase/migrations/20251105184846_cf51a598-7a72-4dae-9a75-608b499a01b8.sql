-- Make project_id optional to support general tasks
ALTER TABLE project_tasks 
ALTER COLUMN project_id DROP NOT NULL;

-- Add comment to clarify the change
COMMENT ON COLUMN project_tasks.project_id IS 'Optional project association. NULL for general tasks not tied to a specific project.';