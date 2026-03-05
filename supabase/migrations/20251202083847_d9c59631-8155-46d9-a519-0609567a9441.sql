-- Add parent_task_id to project_tasks for subtask hierarchy
ALTER TABLE public.project_tasks 
ADD COLUMN parent_task_id uuid REFERENCES public.project_tasks(id) ON DELETE CASCADE;

-- Add parent_task_id to general_tasks for subtask hierarchy
ALTER TABLE public.general_tasks 
ADD COLUMN parent_task_id uuid REFERENCES public.general_tasks(id) ON DELETE CASCADE;

-- Create indexes for efficient subtask queries
CREATE INDEX idx_project_tasks_parent_id ON public.project_tasks(parent_task_id);
CREATE INDEX idx_general_tasks_parent_id ON public.general_tasks(parent_task_id);

-- Add comment for documentation
COMMENT ON COLUMN public.project_tasks.parent_task_id IS 'Reference to parent task for subtask hierarchy';
COMMENT ON COLUMN public.general_tasks.parent_task_id IS 'Reference to parent task for subtask hierarchy';