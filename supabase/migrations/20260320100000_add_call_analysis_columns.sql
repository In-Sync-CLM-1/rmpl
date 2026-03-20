-- Add transcript and call_analysis columns to call_logs
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS transcript text;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS call_analysis jsonb;
