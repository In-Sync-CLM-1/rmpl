-- Add call_method column to track phone vs screen calls
ALTER TABLE call_logs 
ADD COLUMN IF NOT EXISTS call_method TEXT DEFAULT 'phone' 
CHECK (call_method IN ('phone', 'screen'));

-- Add column to store edited contact information during call initiation
ALTER TABLE call_logs 
ADD COLUMN IF NOT EXISTS edited_contact_info JSONB DEFAULT '{}'::jsonb;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_call_logs_call_method ON call_logs(call_method);
CREATE INDEX IF NOT EXISTS idx_call_logs_demandcom_id_method ON call_logs(demandcom_id, call_method);