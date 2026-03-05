-- Add completion_notes column to general_tasks
ALTER TABLE public.general_tasks 
ADD COLUMN IF NOT EXISTS completion_notes text;

-- Add completion_notes column to project_tasks
ALTER TABLE public.project_tasks 
ADD COLUMN IF NOT EXISTS completion_notes text;