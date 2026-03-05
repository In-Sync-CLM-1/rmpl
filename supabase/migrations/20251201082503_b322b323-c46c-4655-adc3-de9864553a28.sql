-- Remove fields from project_livecom_events table
ALTER TABLE public.project_livecom_events
  DROP COLUMN IF EXISTS event_date,
  DROP COLUMN IF EXISTS event_name,
  DROP COLUMN IF EXISTS project_code,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS venue,
  DROP COLUMN IF EXISTS pax,
  DROP COLUMN IF EXISTS cs_manager,
  DROP COLUMN IF EXISTS operations;