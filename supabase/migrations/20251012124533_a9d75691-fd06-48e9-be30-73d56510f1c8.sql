-- Enable required extensions for scheduled cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Add columns to track file cleanup status
ALTER TABLE import_jobs 
ADD COLUMN IF NOT EXISTS file_cleaned_up BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS file_cleanup_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster cleanup queries
CREATE INDEX IF NOT EXISTS idx_import_jobs_cleanup 
ON import_jobs (status, completed_at, file_cleaned_up) 
WHERE status = 'failed' AND file_cleaned_up IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN import_jobs.file_cleaned_up IS 'Whether the uploaded CSV file has been deleted from storage';
COMMENT ON COLUMN import_jobs.file_cleanup_at IS 'Timestamp when the file was deleted from storage';

-- Schedule cleanup job to run daily at 3 AM UTC
SELECT cron.schedule(
  'cleanup-old-import-files',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xbrinligpvtfpqkkllfl.supabase.co/functions/v1/cleanup-old-import-files',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('time', now(), 'trigger', 'scheduled')
  ) as request_id;
  $$
);