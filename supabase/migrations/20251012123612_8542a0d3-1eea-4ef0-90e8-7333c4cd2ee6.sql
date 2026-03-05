-- Add processing stage tracking to import_jobs table
ALTER TABLE import_jobs 
ADD COLUMN IF NOT EXISTS current_stage TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS stage_details JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN import_jobs.current_stage IS 'Current processing stage: pending, uploading, downloading, validating, parsing, inserting, finalizing, completed, failed';
COMMENT ON COLUMN import_jobs.stage_details IS 'Additional stage information like messages, batch numbers, etc.';