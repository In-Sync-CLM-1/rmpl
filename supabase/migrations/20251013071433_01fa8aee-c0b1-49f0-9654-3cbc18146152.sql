-- Make job_seeker_id nullable to support CSV-based campaigns
ALTER TABLE campaign_recipients 
ALTER COLUMN job_seeker_id DROP NOT NULL;

-- Add a comment explaining the design
COMMENT ON COLUMN campaign_recipients.job_seeker_id IS 
'Optional reference to job_seekers table. NULL when campaign is sent to CSV-uploaded contacts.';