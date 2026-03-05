-- Add reporting_to column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN reports_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_profiles_reports_to ON public.profiles(reports_to);

-- Add comment
COMMENT ON COLUMN public.profiles.reports_to IS 'The user ID of the manager this user reports to';