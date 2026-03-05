-- Add new columns to clients table
ALTER TABLE clients 
  ADD COLUMN contact_name TEXT,
  ADD COLUMN official_address TEXT,
  ADD COLUMN residence_address TEXT,
  ADD COLUMN contact_number TEXT,
  ADD COLUMN email_id TEXT,
  ADD COLUMN birthday_date DATE,
  ADD COLUMN anniversary_date DATE,
  ADD COLUMN company_linkedin_page TEXT,
  ADD COLUMN linkedin_id TEXT;

-- Make contact_name required and unique
ALTER TABLE clients ALTER COLUMN contact_name SET NOT NULL;
CREATE UNIQUE INDEX idx_clients_contact_name ON clients(contact_name);

-- Update project_quotations table for file uploads
ALTER TABLE project_quotations
  ADD COLUMN file_path TEXT,
  ADD COLUMN file_name TEXT,
  ADD COLUMN file_size BIGINT,
  ADD COLUMN file_type TEXT;

-- Make amount and notes nullable
ALTER TABLE project_quotations ALTER COLUMN amount DROP NOT NULL;

-- Create storage bucket for project quotations
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-quotations',
  'project-quotations',
  false,
  10485760, -- 10MB in bytes
  ARRAY['application/pdf']
);

-- RLS policies for project-quotations storage bucket
CREATE POLICY "Users can upload quotations for their projects"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-quotations' 
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT id FROM projects WHERE created_by = auth.uid()
  )
);

CREATE POLICY "Users can view quotations for accessible projects"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-quotations'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT id FROM projects 
    WHERE can_access_project(auth.uid(), id)
  )
);

CREATE POLICY "Users can delete quotations for their projects"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-quotations'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT id FROM projects WHERE created_by = auth.uid()
  )
);