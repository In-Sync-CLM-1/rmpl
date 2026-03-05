-- Create project_livecom_events table for managing LiveCom event details
CREATE TABLE IF NOT EXISTS public.project_livecom_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  event_date DATE,
  event_name TEXT,
  project_code TEXT,
  city TEXT,
  venue TEXT,
  pax INTEGER,
  cs_manager TEXT,
  operations TEXT,
  fabrication_av_vendor TEXT,
  services TEXT,
  internal_cost_exc_tax NUMERIC(12, 2),
  rating_by_livecom INTEGER CHECK (rating_by_livecom >= 1 AND rating_by_livecom <= 5),
  rating_by_csbd INTEGER CHECK (rating_by_csbd >= 1 AND rating_by_csbd <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.project_livecom_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view livecom events for accessible projects"
  ON public.project_livecom_events
  FOR SELECT
  USING (can_access_project(auth.uid(), project_id));

CREATE POLICY "Users can insert livecom events for accessible projects"
  ON public.project_livecom_events
  FOR INSERT
  WITH CHECK (can_access_project(auth.uid(), project_id));

CREATE POLICY "Users can update livecom events for accessible projects"
  ON public.project_livecom_events
  FOR UPDATE
  USING (can_access_project(auth.uid(), project_id));

CREATE POLICY "Users can delete livecom events for accessible projects"
  ON public.project_livecom_events
  FOR DELETE
  USING (can_access_project(auth.uid(), project_id));

-- Create index for faster lookups
CREATE INDEX idx_project_livecom_events_project_id ON public.project_livecom_events(project_id);

-- Update trigger for updated_at
CREATE TRIGGER update_project_livecom_events_updated_at
  BEFORE UPDATE ON public.project_livecom_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();