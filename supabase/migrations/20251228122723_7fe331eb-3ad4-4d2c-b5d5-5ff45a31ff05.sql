
-- Create point_activity_types table to configure point values
CREATE TABLE public.point_activity_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_type TEXT NOT NULL UNIQUE,
  points_value INTEGER NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.point_activity_types ENABLE ROW LEVEL SECURITY;

-- Everyone can view activity types
CREATE POLICY "Anyone can view activity types"
ON public.point_activity_types FOR SELECT
USING (true);

-- Only admins can manage activity types
CREATE POLICY "Admins can manage activity types"
ON public.point_activity_types FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Insert default activity types
INSERT INTO public.point_activity_types (activity_type, points_value, description) VALUES
('call_made', 1, 'Points for each call made'),
('registration', 5, 'Points for each registration achieved'),
('target_achieved', 10, 'Points for achieving daily target'),
('attendance_signin', 2, 'Points for signing in attendance'),
('task_completed', 3, 'Points for completing a task'),
('onboarding_completed', 20, 'Points for completing onboarding'),
('announcement_read', 1, 'Points for reading a system announcement'),
('daily_non_usage', -1, 'Deduction for not using the system for a day');
