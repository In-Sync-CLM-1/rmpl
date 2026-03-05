-- Add column for storing multiple completion files as JSONB array
-- Format: [{"path": "...", "name": "...", "size": 123}, ...]
ALTER TABLE public.general_tasks 
ADD COLUMN IF NOT EXISTS completion_files JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.general_tasks.completion_files IS 'Array of completion files with path, name, and size';