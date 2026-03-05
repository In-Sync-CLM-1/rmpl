-- Add completion file columns to general_tasks
ALTER TABLE general_tasks 
ADD COLUMN completion_file_path TEXT,
ADD COLUMN completion_file_name TEXT;

-- Add completion file columns to project_tasks
ALTER TABLE project_tasks 
ADD COLUMN completion_file_path TEXT,
ADD COLUMN completion_file_name TEXT;

-- Create storage bucket for task completion files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('task-completion-files', 'task-completion-files', true);

-- RLS policy for authenticated users to upload task files
CREATE POLICY "Authenticated users can upload task files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-completion-files');

-- RLS policy for authenticated users to view task files
CREATE POLICY "Authenticated users can view task files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'task-completion-files');