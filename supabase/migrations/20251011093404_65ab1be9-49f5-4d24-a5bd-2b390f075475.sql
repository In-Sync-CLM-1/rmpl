-- Create teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  team_lead_id UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create designations table
CREATE TABLE public.designations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL UNIQUE,
  description TEXT,
  level INTEGER, -- Seniority level (1-10)
  department TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create pipeline_stages table
CREATE TABLE public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  stage_order INTEGER NOT NULL,
  stage_type TEXT NOT NULL DEFAULT 'candidate', -- 'candidate', 'client', 'job'
  color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name, stage_type)
);

-- Create team_members junction table
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  role_in_team TEXT DEFAULT 'member', -- 'member', 'lead', 'admin'
  is_active BOOLEAN DEFAULT true,
  UNIQUE(team_id, user_id)
);

-- Create user_designations to link users with their designations
CREATE TABLE public.user_designations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  designation_id UUID NOT NULL REFERENCES public.designations(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  is_current BOOLEAN DEFAULT true,
  UNIQUE(user_id, designation_id)
);

-- Create candidate_pipeline to track candidate progression
CREATE TABLE public.candidate_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exited_at TIMESTAMPTZ,
  notes TEXT,
  moved_by UUID REFERENCES auth.users(id),
  is_current BOOLEAN DEFAULT true
);

-- Add indexes for performance
CREATE INDEX idx_teams_team_lead ON public.teams(team_lead_id);
CREATE INDEX idx_team_members_team ON public.team_members(team_id);
CREATE INDEX idx_team_members_user ON public.team_members(user_id);
CREATE INDEX idx_user_designations_user ON public.user_designations(user_id);
CREATE INDEX idx_user_designations_designation ON public.user_designations(designation_id);
CREATE INDEX idx_candidate_pipeline_candidate ON public.candidate_pipeline(candidate_id);
CREATE INDEX idx_candidate_pipeline_stage ON public.candidate_pipeline(stage_id);
CREATE INDEX idx_candidate_pipeline_current ON public.candidate_pipeline(is_current) WHERE is_current = true;
CREATE INDEX idx_pipeline_stages_type_order ON public.pipeline_stages(stage_type, stage_order);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_pipeline ENABLE ROW LEVEL SECURITY;

-- RLS Policies for teams
CREATE POLICY "Authenticated users can view teams"
ON public.teams FOR SELECT TO authenticated USING (true);

CREATE POLICY "Team leads and admins can update their teams"
ON public.teams FOR UPDATE TO authenticated
USING (team_lead_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can create teams"
ON public.teams FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can delete teams"
ON public.teams FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- RLS Policies for designations
CREATE POLICY "Authenticated users can view designations"
ON public.designations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage designations"
ON public.designations FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- RLS Policies for pipeline_stages
CREATE POLICY "Authenticated users can view pipeline stages"
ON public.pipeline_stages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage pipeline stages"
ON public.pipeline_stages FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- RLS Policies for team_members
CREATE POLICY "Users can view their team memberships"
ON public.team_members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Team leads and admins can manage team members"
ON public.team_members FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teams
    WHERE teams.id = team_members.team_id
    AND (teams.team_lead_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
  )
);

-- RLS Policies for user_designations
CREATE POLICY "Users can view designations"
ON public.user_designations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage user designations"
ON public.user_designations FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- RLS Policies for candidate_pipeline
CREATE POLICY "Authenticated users can view candidate pipeline"
ON public.candidate_pipeline FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage candidate pipeline"
ON public.candidate_pipeline FOR ALL TO authenticated
USING (true);

-- Create triggers for updated_at
CREATE TRIGGER update_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_designations_updated_at
BEFORE UPDATE ON public.designations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pipeline_stages_updated_at
BEFORE UPDATE ON public.pipeline_stages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default pipeline stages for candidates
INSERT INTO public.pipeline_stages (name, description, stage_order, stage_type, color) VALUES
('New Lead', 'Newly added candidate', 1, 'candidate', '#6B7280'),
('Contacted', 'Initial contact made', 2, 'candidate', '#3B82F6'),
('Qualified', 'Candidate qualified for positions', 3, 'candidate', '#8B5CF6'),
('Submitted', 'Submitted to client', 4, 'candidate', '#F59E0B'),
('Interview Scheduled', 'Interview scheduled with client', 5, 'candidate', '#10B981'),
('Offered', 'Job offer extended', 6, 'candidate', '#06B6D4'),
('Placed', 'Successfully placed', 7, 'candidate', '#22C55E'),
('Rejected', 'Not selected', 8, 'candidate', '#EF4444'),
('Withdrawn', 'Candidate withdrew', 9, 'candidate', '#DC2626'),
('On Hold', 'Temporarily paused', 10, 'candidate', '#F97316');