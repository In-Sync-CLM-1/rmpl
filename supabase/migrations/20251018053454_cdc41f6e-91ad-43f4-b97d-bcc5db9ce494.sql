-- Add contact_id column to projects table
ALTER TABLE public.projects 
ADD COLUMN contact_id text;

-- Add comment to describe the column
COMMENT ON COLUMN public.projects.contact_id IS 'Mobile number (mobile_numb) from master table representing the contact person for this project';