-- Modify projects table to support half-day/full-day event dates
ALTER TABLE public.projects 
DROP COLUMN IF EXISTS event_dates;

ALTER TABLE public.projects 
ADD COLUMN event_dates JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.projects.event_dates IS 'Array of objects: [{date: "2024-01-01", type: "full_day"|"first_half"|"second_half"}]';