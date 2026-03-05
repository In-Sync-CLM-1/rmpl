-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('task_assigned', 'due_soon', 'overdue')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better query performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_notifications_task_id ON public.notifications(task_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Trigger function to create notification when task is assigned
CREATE OR REPLACE FUNCTION notify_task_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify on INSERT or when assigned_to changes
  IF (TG_OP = 'INSERT') OR (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    -- Don't notify if user assigns task to themselves
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.assigned_by THEN
      INSERT INTO public.notifications (
        user_id,
        task_id,
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

-- Attach trigger to project_tasks table
CREATE TRIGGER task_assignment_notification
AFTER INSERT OR UPDATE OF assigned_to ON public.project_tasks
FOR EACH ROW
EXECUTE FUNCTION notify_task_assignment();

-- Enable realtime replication for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;