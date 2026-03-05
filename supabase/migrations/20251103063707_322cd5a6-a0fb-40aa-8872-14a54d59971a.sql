-- Create project_team_notifications tracking table
CREATE TABLE IF NOT EXISTS public.project_team_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  notification_type TEXT NOT NULL DEFAULT 'project_assignment',
  UNIQUE(project_id, user_id, notification_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_team_notifications_project 
ON public.project_team_notifications(project_id);

CREATE INDEX IF NOT EXISTS idx_project_team_notifications_user 
ON public.project_team_notifications(user_id);

-- Enable RLS
ALTER TABLE public.project_team_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view notifications for projects they can access
CREATE POLICY "Users can view notifications for accessible projects"
ON public.project_team_notifications
FOR SELECT
USING (can_access_project(auth.uid(), project_id));

-- RLS Policy: System can insert notification records
CREATE POLICY "System can insert notification records"
ON public.project_team_notifications
FOR INSERT
WITH CHECK (can_access_project(auth.uid(), project_id));