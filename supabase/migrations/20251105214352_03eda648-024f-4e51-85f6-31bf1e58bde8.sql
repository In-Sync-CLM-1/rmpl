-- Enable pg_net extension for HTTP requests from database
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to send task assignment email notification
CREATE OR REPLACE FUNCTION send_task_assignment_email()
RETURNS TRIGGER AS $$
DECLARE
  task_data RECORD;
  assigned_user_data RECORD;
  assigned_by_data RECORD;
  supabase_url TEXT;
  supabase_anon_key TEXT;
BEGIN
  -- Only send email on INSERT or when assigned_to changes
  IF (TG_OP = 'INSERT') OR (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    -- Don't send email if user assigns task to themselves
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.assigned_by THEN
      
      -- Get task details
      SELECT * INTO task_data FROM project_tasks WHERE id = NEW.id;
      
      -- Get assigned user email
      SELECT email, full_name INTO assigned_user_data 
      FROM profiles WHERE id = NEW.assigned_to;
      
      -- Get assigned by user name
      SELECT full_name INTO assigned_by_data 
      FROM profiles WHERE id = NEW.assigned_by;
      
      -- Get Supabase URL and anon key from environment
      supabase_url := current_setting('app.settings.supabase_url', true);
      supabase_anon_key := current_setting('app.settings.supabase_anon_key', true);
      
      IF assigned_user_data.email IS NOT NULL THEN
        -- Call edge function to send email using pg_net
        PERFORM net.http_post(
          url := supabase_url || '/functions/v1/send-task-notification-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || supabase_anon_key
          ),
          body := jsonb_build_object(
            'user_id', NEW.assigned_to,
            'task_id', NEW.id,
            'notification_type', 'task_assigned',
            'task_name', task_data.task_name,
            'due_date', task_data.due_date,
            'assigned_by_name', assigned_by_data.full_name
          )
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to send email on task assignment
DROP TRIGGER IF EXISTS send_task_assignment_email_trigger ON project_tasks;
CREATE TRIGGER send_task_assignment_email_trigger
  AFTER INSERT OR UPDATE OF assigned_to ON project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION send_task_assignment_email();

-- Set configuration parameters for the database (these should be set via environment variables in production)
-- Note: These are placeholders and should be configured properly in your Supabase project settings
COMMENT ON FUNCTION send_task_assignment_email IS 'Sends email notification when a task is assigned. Requires app.settings.supabase_url and app.settings.supabase_anon_key to be configured.';
