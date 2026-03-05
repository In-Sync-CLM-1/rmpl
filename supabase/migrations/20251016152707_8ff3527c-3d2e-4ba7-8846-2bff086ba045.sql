-- Add import_job_id to profiles table to track which import created each user
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS import_job_id uuid REFERENCES public.user_import_jobs(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_import_job_id ON public.profiles(import_job_id);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.import_job_id IS 'Tracks which bulk import job created this user profile';