-- Add audience_data field to campaigns table to store CSV upload data
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS audience_data jsonb;

COMMENT ON COLUMN campaigns.audience_data IS 'Stores uploaded CSV audience data as JSON array of objects';