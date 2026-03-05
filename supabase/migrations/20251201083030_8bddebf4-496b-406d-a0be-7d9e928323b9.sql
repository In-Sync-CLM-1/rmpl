-- Add remarks field to project_livecom_events
ALTER TABLE public.project_livecom_events
  ADD COLUMN IF NOT EXISTS remarks TEXT;