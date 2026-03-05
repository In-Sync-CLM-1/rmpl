-- Create general_tasks table for non-project tasks
CREATE TABLE IF NOT EXISTS public.general_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name TEXT NOT NULL,
  description TEXT,
  assigned_to UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.general_tasks ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can create general tasks
CREATE POLICY "Authenticated users can create general tasks"
ON public.general_tasks
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = assigned_by
);

-- Policy: Users can view tasks assigned to them or created by them
CREATE POLICY "Users can view their general tasks"
ON public.general_tasks
FOR SELECT
USING (
  auth.uid() = assigned_to 
  OR auth.uid() = assigned_by
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'platform_admin'::app_role)
);

-- Policy: Users can update tasks they created or are assigned to
CREATE POLICY "Users can update their general tasks"
ON public.general_tasks
FOR UPDATE
USING (
  auth.uid() = assigned_to 
  OR auth.uid() = assigned_by
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'platform_admin'::app_role)
);

-- Policy: Users can delete tasks they created or admins
CREATE POLICY "Users can delete their general tasks"
ON public.general_tasks
FOR DELETE
USING (
  auth.uid() = assigned_by
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'platform_admin'::app_role)
);

-- Create trigger for updated_at
CREATE TRIGGER update_general_tasks_updated_at
BEFORE UPDATE ON public.general_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for completed_at
CREATE OR REPLACE FUNCTION public.update_general_tasks_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_general_tasks_status
BEFORE UPDATE ON public.general_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_general_tasks_completed_at();

-- Update notifications table to support general tasks
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS general_task_id UUID REFERENCES public.general_tasks(id) ON DELETE CASCADE;

-- Create notification trigger for general tasks
CREATE OR REPLACE FUNCTION public.notify_general_task_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.assigned_by THEN
      INSERT INTO public.notifications (
        user_id,
        general_task_id,
        notification_type,
        title,
        message
      ) VALUES (
        NEW.assigned_to,
        NEW.id,
        'task_assigned',
        'New Task Assigned',
        'You have been assigned a new task: ' || NEW.task_name
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notify_general_task_assignment_trigger
AFTER INSERT OR UPDATE ON public.general_tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_general_task_assignment();