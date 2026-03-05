-- Create projects table for event management
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name TEXT NOT NULL,
  brief TEXT,
  client_id TEXT REFERENCES public.clients(mobile_numb),
  locations JSONB DEFAULT '[]'::jsonb, -- Array of {city: string, venue: string}
  event_dates DATE[] DEFAULT '{}', -- Array of dates
  status TEXT NOT NULL DEFAULT 'new',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('new', 'active', 'completed', 'cancelled'))
);

-- Create project_files table for file uploads
CREATE TABLE IF NOT EXISTS public.project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'other',
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_file_type CHECK (file_type IN ('brief', 'quotation', 'other'))
);

-- Create project_team_members table
CREATE TABLE IF NOT EXISTS public.project_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  role_in_project TEXT NOT NULL DEFAULT 'member',
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_role CHECK (role_in_project IN ('lead', 'member', 'consultant')),
  UNIQUE(project_id, user_id)
);

-- Create project_quotations table
CREATE TABLE IF NOT EXISTS public.project_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  quotation_number TEXT UNIQUE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_to_email TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_quotation_status CHECK (status IN ('draft', 'sent', 'approved', 'rejected'))
);

-- Create storage bucket for project files
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_quotations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Users can view projects they created or are team members of"
  ON public.projects FOR SELECT
  USING (
    auth.uid() = created_by
    OR auth.uid() IN (
      SELECT user_id FROM public.project_team_members WHERE project_id = projects.id
    )
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'platform_admin'::app_role)
  );

CREATE POLICY "Users can create projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Project creators and admins can update projects"
  ON public.projects FOR UPDATE
  USING (
    auth.uid() = created_by
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'platform_admin'::app_role)
  );

CREATE POLICY "Project creators and admins can delete projects"
  ON public.projects FOR DELETE
  USING (
    auth.uid() = created_by
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'platform_admin'::app_role)
  );

-- RLS Policies for project_files
CREATE POLICY "Users can view files for accessible projects"
  ON public.project_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_files.project_id
      AND (
        auth.uid() = projects.created_by
        OR auth.uid() IN (
          SELECT user_id FROM public.project_team_members WHERE project_id = projects.id
        )
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)
        OR has_role(auth.uid(), 'platform_admin'::app_role)
      )
    )
  );

CREATE POLICY "Users can upload files to accessible projects"
  ON public.project_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_files.project_id
      AND (
        auth.uid() = projects.created_by
        OR auth.uid() IN (
          SELECT user_id FROM public.project_team_members WHERE project_id = projects.id
        )
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)
        OR has_role(auth.uid(), 'platform_admin'::app_role)
      )
    )
  );

CREATE POLICY "File uploaders and admins can delete files"
  ON public.project_files FOR DELETE
  USING (
    auth.uid() = uploaded_by
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'platform_admin'::app_role)
  );

-- RLS Policies for project_team_members
CREATE POLICY "Users can view team members for accessible projects"
  ON public.project_team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_team_members.project_id
      AND (
        auth.uid() = projects.created_by
        OR auth.uid() IN (
          SELECT user_id FROM public.project_team_members ptm WHERE ptm.project_id = projects.id
        )
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)
        OR has_role(auth.uid(), 'platform_admin'::app_role)
      )
    )
  );

CREATE POLICY "Project creators and admins can manage team members"
  ON public.project_team_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_team_members.project_id
      AND (
        auth.uid() = projects.created_by
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)
        OR has_role(auth.uid(), 'platform_admin'::app_role)
      )
    )
  );

-- RLS Policies for project_quotations
CREATE POLICY "Users can view quotations for accessible projects"
  ON public.project_quotations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_quotations.project_id
      AND (
        auth.uid() = projects.created_by
        OR auth.uid() IN (
          SELECT user_id FROM public.project_team_members WHERE project_id = projects.id
        )
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)
        OR has_role(auth.uid(), 'platform_admin'::app_role)
      )
    )
  );

CREATE POLICY "Project creators and admins can manage quotations"
  ON public.project_quotations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_quotations.project_id
      AND (
        auth.uid() = projects.created_by
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)
        OR has_role(auth.uid(), 'platform_admin'::app_role)
      )
    )
  );

-- Storage policies for project-files bucket
CREATE POLICY "Users can view files for accessible projects"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-files'
    AND (
      EXISTS (
        SELECT 1 FROM public.project_files pf
        JOIN public.projects p ON p.id = pf.project_id
        WHERE pf.file_path = storage.objects.name
        AND (
          auth.uid() = p.created_by
          OR auth.uid() IN (
            SELECT user_id FROM public.project_team_members WHERE project_id = p.id
          )
          OR has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'super_admin'::app_role)
          OR has_role(auth.uid(), 'platform_admin'::app_role)
        )
      )
    )
  );

CREATE POLICY "Users can upload files to accessible projects"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-files'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete their uploaded files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-files'
    AND (
      EXISTS (
        SELECT 1 FROM public.project_files
        WHERE file_path = storage.objects.name
        AND uploaded_by = auth.uid()
      )
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'platform_admin'::app_role)
    )
  );

-- Add triggers for updated_at
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_quotations_updated_at
  BEFORE UPDATE ON public.project_quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_projects_created_by ON public.projects(created_by);
CREATE INDEX idx_projects_client_id ON public.projects(client_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_project_files_project_id ON public.project_files(project_id);
CREATE INDEX idx_project_team_members_project_id ON public.project_team_members(project_id);
CREATE INDEX idx_project_team_members_user_id ON public.project_team_members(user_id);
CREATE INDEX idx_project_quotations_project_id ON public.project_quotations(project_id);