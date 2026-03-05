-- Create table for DemandCom resource allocations per project
CREATE TABLE public.project_demandcom_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  registration_target INTEGER DEFAULT 0,
  data_allocation INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Enable RLS
ALTER TABLE public.project_demandcom_allocations ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can view allocations for accessible projects
CREATE POLICY "Users can view demandcom allocations for accessible projects" 
  ON public.project_demandcom_allocations 
  FOR SELECT 
  USING (can_access_project(auth.uid(), project_id));

-- RLS policy: Users can insert allocations for accessible projects
CREATE POLICY "Users can insert demandcom allocations for accessible projects" 
  ON public.project_demandcom_allocations 
  FOR INSERT 
  WITH CHECK (can_access_project(auth.uid(), project_id));

-- RLS policy: Users can update allocations for accessible projects
CREATE POLICY "Users can update demandcom allocations for accessible projects" 
  ON public.project_demandcom_allocations 
  FOR UPDATE 
  USING (can_access_project(auth.uid(), project_id));

-- RLS policy: Users can delete allocations for accessible projects
CREATE POLICY "Users can delete demandcom allocations for accessible projects" 
  ON public.project_demandcom_allocations 
  FOR DELETE 
  USING (can_access_project(auth.uid(), project_id));

-- Create trigger for updated_at
CREATE TRIGGER update_project_demandcom_allocations_updated_at
  BEFORE UPDATE ON public.project_demandcom_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();