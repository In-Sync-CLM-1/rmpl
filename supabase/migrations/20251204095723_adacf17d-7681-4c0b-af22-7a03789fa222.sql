-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create general tasks" ON public.general_tasks;

-- Create updated INSERT policy that allows:
-- 1. Anyone creating a task where they are the assigner (assigned_by)
-- 2. Anyone assigned to the parent task can create subtasks
CREATE POLICY "Authenticated users can create general tasks" 
ON public.general_tasks 
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    -- User is the assigner
    auth.uid() = assigned_by
    OR
    -- User is assigned to the parent task (for subtasks)
    (
      parent_task_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM public.general_tasks parent 
        WHERE parent.id = parent_task_id 
        AND parent.assigned_to = auth.uid()
      )
    )
  )
);