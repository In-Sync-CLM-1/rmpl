-- Add file_size column to project_files table
ALTER TABLE public.project_files 
ADD COLUMN IF NOT EXISTS file_size BIGINT;