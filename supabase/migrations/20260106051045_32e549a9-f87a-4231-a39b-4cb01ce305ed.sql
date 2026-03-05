-- Add referrer_name column to projects table for when source is 'reference'
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS referrer_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.projects.referrer_name IS 'Name of the referrer when project_source is reference';