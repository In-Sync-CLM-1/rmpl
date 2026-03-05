-- Rename existing remarks to remarks_by_livecom and add remarks_by_csbd
ALTER TABLE public.project_livecom_events
  RENAME COLUMN remarks TO remarks_by_livecom;

ALTER TABLE public.project_livecom_events
  ADD COLUMN IF NOT EXISTS remarks_by_csbd TEXT;