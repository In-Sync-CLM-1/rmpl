-- Add new fields to job_seekers table for comprehensive candidate tracking
ALTER TABLE public.job_seekers
ADD COLUMN IF NOT EXISTS middle_name text,
ADD COLUMN IF NOT EXISTS ssn text,
ADD COLUMN IF NOT EXISTS work_authorization text,
ADD COLUMN IF NOT EXISTS skype_id text,
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS linkedin_url text,
ADD COLUMN IF NOT EXISTS date_of_birth date,
ADD COLUMN IF NOT EXISTS job_title text,
ADD COLUMN IF NOT EXISTS gender text,
ADD COLUMN IF NOT EXISTS preferred_location text,
ADD COLUMN IF NOT EXISTS expected_salary numeric;

-- Add helpful comment
COMMENT ON COLUMN public.job_seekers.ssn IS 'Social Security Number - handle with care';
COMMENT ON COLUMN public.job_seekers.work_authorization IS 'e.g., US Citizen, Work Visa, Green Card';
COMMENT ON COLUMN public.job_seekers.expected_salary IS 'Expected annual salary';
COMMENT ON COLUMN public.job_seekers.preferred_location IS 'Preferred work location';