-- Create enum for recommendation types
CREATE TYPE recommendation_type AS ENUM ('contact', 'campaign', 'follow_up', 'placement', 're_engage', 'update_profile');

-- Create enum for priority levels
CREATE TYPE priority_level AS ENUM ('high', 'medium', 'low');

-- Create enum for recommendation status
CREATE TYPE recommendation_status AS ENUM ('pending', 'completed', 'dismissed');

-- Create candidate_recommendations table
CREATE TABLE public.candidate_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  recommendation_type recommendation_type NOT NULL,
  priority priority_level NOT NULL,
  action_title TEXT NOT NULL,
  action_description TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  metadata JSONB DEFAULT '{}'::jsonb,
  status recommendation_status DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_candidate_recommendations_candidate ON public.candidate_recommendations(candidate_id);
CREATE INDEX idx_candidate_recommendations_status ON public.candidate_recommendations(status);
CREATE INDEX idx_candidate_recommendations_priority ON public.candidate_recommendations(priority);
CREATE INDEX idx_candidate_recommendations_expires ON public.candidate_recommendations(expires_at) WHERE expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE public.candidate_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view recommendations"
ON public.candidate_recommendations
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create recommendations"
ON public.candidate_recommendations
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update recommendations"
ON public.candidate_recommendations
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Admins can delete recommendations"
ON public.candidate_recommendations
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- Create candidate_engagement_summary table
CREATE TABLE public.candidate_engagement_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL UNIQUE REFERENCES public.candidates(id) ON DELETE CASCADE,
  total_campaigns_sent INTEGER DEFAULT 0,
  total_emails_opened INTEGER DEFAULT 0,
  total_links_clicked INTEGER DEFAULT 0,
  last_contacted_at TIMESTAMPTZ,
  last_engaged_at TIMESTAMPTZ,
  engagement_score NUMERIC(3,2) CHECK (engagement_score >= 0 AND engagement_score <= 1),
  response_rate NUMERIC(5,2),
  avg_time_to_respond_hours NUMERIC,
  preferred_contact_time TEXT,
  last_ai_analysis_at TIMESTAMPTZ,
  ai_insights JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.candidate_engagement_summary ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view engagement summaries"
ON public.candidate_engagement_summary
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "System can manage engagement summaries"
ON public.candidate_engagement_summary
FOR ALL
TO authenticated
USING (true);

-- Create trigger to update updated_at
CREATE TRIGGER update_candidate_recommendations_updated_at
BEFORE UPDATE ON public.candidate_recommendations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_candidate_engagement_summary_updated_at
BEFORE UPDATE ON public.candidate_engagement_summary
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();