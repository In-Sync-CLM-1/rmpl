-- Add restart tracking fields to general_tasks
ALTER TABLE general_tasks 
ADD COLUMN IF NOT EXISTS restart_reason text,
ADD COLUMN IF NOT EXISTS restarted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS restarted_by uuid REFERENCES profiles(id);

-- Add restart tracking fields to project_tasks
ALTER TABLE project_tasks 
ADD COLUMN IF NOT EXISTS restart_reason text,
ADD COLUMN IF NOT EXISTS restarted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS restarted_by uuid REFERENCES profiles(id);