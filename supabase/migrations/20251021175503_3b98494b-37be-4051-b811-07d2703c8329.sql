-- Create enum for tour types
CREATE TYPE tour_type AS ENUM ('initial', 'feature_update');

-- Create enum for onboarding status
CREATE TYPE onboarding_status AS ENUM ('not_started', 'in_progress', 'completed', 'skipped');

-- Stores onboarding tours/feature announcements
CREATE TABLE onboarding_tours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  version integer NOT NULL,
  tour_type tour_type NOT NULL,
  target_roles text[],
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Stores individual steps in a tour
CREATE TABLE onboarding_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id uuid REFERENCES onboarding_tours(id) ON DELETE CASCADE NOT NULL,
  step_order integer NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  target_element text,
  target_route text,
  image_url text,
  action_label text DEFAULT 'Next',
  created_at timestamptz DEFAULT now()
);

-- Tracks user progress through tours
CREATE TABLE user_onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tour_id uuid REFERENCES onboarding_tours(id) ON DELETE CASCADE NOT NULL,
  status onboarding_status DEFAULT 'not_started',
  current_step_id uuid REFERENCES onboarding_steps(id),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tour_id)
);

-- Add onboarding fields to profiles
ALTER TABLE profiles 
ADD COLUMN onboarding_completed boolean DEFAULT false,
ADD COLUMN onboarding_skipped boolean DEFAULT false,
ADD COLUMN last_tour_version_seen integer DEFAULT 0;

-- Enable RLS
ALTER TABLE onboarding_tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_onboarding_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for onboarding_tours
CREATE POLICY "Authenticated users can view active tours"
ON onboarding_tours FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Admins can manage tours"
ON onboarding_tours FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

-- RLS Policies for onboarding_steps
CREATE POLICY "Authenticated users can view steps for active tours"
ON onboarding_steps FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM onboarding_tours 
    WHERE id = onboarding_steps.tour_id 
    AND is_active = true
  )
);

CREATE POLICY "Admins can manage steps"
ON onboarding_steps FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

-- RLS Policies for user_onboarding_progress
CREATE POLICY "Users can view their own progress"
ON user_onboarding_progress FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own progress"
ON user_onboarding_progress FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own progress"
ON user_onboarding_progress FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all progress"
ON user_onboarding_progress FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'platform_admin'::app_role)
);

-- Create indexes for performance
CREATE INDEX idx_onboarding_tours_active ON onboarding_tours(is_active);
CREATE INDEX idx_onboarding_tours_version ON onboarding_tours(version);
CREATE INDEX idx_onboarding_steps_tour ON onboarding_steps(tour_id, step_order);
CREATE INDEX idx_user_progress_user ON user_onboarding_progress(user_id);
CREATE INDEX idx_user_progress_tour ON user_onboarding_progress(tour_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_onboarding_tours_updated_at
  BEFORE UPDATE ON onboarding_tours
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_onboarding_progress_updated_at
  BEFORE UPDATE ON user_onboarding_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert initial welcome tour
INSERT INTO onboarding_tours (title, description, version, tour_type, is_active)
VALUES (
  'Welcome to RMPL CRM',
  'Get started with the essential features of RMPL CRM',
  1,
  'initial',
  true
);

-- Get the tour_id for inserting steps
DO $$
DECLARE
  tour_id uuid;
BEGIN
  SELECT id INTO tour_id FROM onboarding_tours WHERE title = 'Welcome to RMPL CRM';

  -- Insert initial tour steps
  INSERT INTO onboarding_steps (tour_id, step_order, title, content, target_route, action_label) VALUES
  (tour_id, 1, 'Welcome to RMPL CRM! 👋', 
   'We''re excited to have you here! Let''s take a quick tour to help you get started with the platform. You can skip this anytime and replay it later from the help menu.',
   '/dashboard', 'Get Started'),
  
  (tour_id, 2, 'Your Dashboard Overview 📊',
   'This is your command center. Here you''ll see key metrics, AI-powered recommendations, and quick actions to manage your work efficiently.',
   '/dashboard', 'Next'),
  
  (tour_id, 3, 'Participant Management 👥',
   'Manage all your participants in one place. Add participants manually, import in bulk, or use our AI-powered search to find exactly who you''re looking for.',
   '/demandcom', 'Next'),
  
  (tour_id, 4, 'AI Recommendations 🤖',
   'Our AI analyzes engagement patterns and suggests the perfect next action for each participant. Focus on high-priority recommendations for maximum impact.',
   '/ai-recommendations', 'Next'),
  
  (tour_id, 5, 'Create Campaigns 📧',
   'Build targeted email and SMS campaigns using our templates. Reach the right people with the right message at the right time.',
   '/campaigns', 'Next'),
  
  (tour_id, 6, 'Templates Library 📝',
   'Access pre-built email and SMS templates. Customize them with merge tags to personalize every message automatically.',
   '/templates', 'Next'),
  
  (tour_id, 7, 'You''re All Set! 🎉',
   'You''ve completed the tour! Explore the platform and don''t hesitate to replay this tour anytime from the help menu. Need assistance? Our support team is here to help.',
   '/dashboard', 'Finish');
END $$;