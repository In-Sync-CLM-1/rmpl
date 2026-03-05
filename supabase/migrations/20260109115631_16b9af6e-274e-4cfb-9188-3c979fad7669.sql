-- Add employee exit tracking columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS exit_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS exit_reason text;

-- Add index for filtering active/inactive employees
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- Update existing records to be active (if they don't have a value)
UPDATE public.profiles SET is_active = true WHERE is_active IS NULL;