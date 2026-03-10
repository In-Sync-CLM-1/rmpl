-- Fix security issue: Set search_path for send_task_assignment_email function
CREATE OR REPLACE FUNCTION public.send_task_assignment_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  task_data RECORD;
  assigned_user_data RECORD;
  assigned_by_data RECORD;
  supabase_url TEXT := 'https://ltlvhmwrrsromwuiybwu.supabase.co';
  supabase_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0bHZobXdycnNyb213dWl5Ynd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzk0OTUsImV4cCI6MjA4ODY1NTQ5NX0.VrY_nFei4c-LBWtS_9LP9xtAK2eS2L19Iy0M7V-Vqq0';
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
$function$;