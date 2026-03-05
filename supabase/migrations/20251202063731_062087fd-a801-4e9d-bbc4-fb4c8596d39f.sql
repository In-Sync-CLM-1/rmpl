-- Add number_of_attendees column to projects table
ALTER TABLE public.projects ADD COLUMN number_of_attendees integer DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.projects.number_of_attendees IS 'Expected number of attendees for the project event, used for demandcom analysis';