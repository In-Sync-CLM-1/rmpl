-- Add missing columns to master table to mirror demandcom structure

-- Add id column (UUID)
ALTER TABLE master ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

-- Add assignment-related columns
ALTER TABLE master ADD COLUMN IF NOT EXISTS assigned_to uuid;
ALTER TABLE master ADD COLUMN IF NOT EXISTS assigned_by uuid;
ALTER TABLE master ADD COLUMN IF NOT EXISTS assigned_at timestamp with time zone;
ALTER TABLE master ADD COLUMN IF NOT EXISTS assignment_status text DEFAULT 'unassigned';

-- Add call tracking columns
ALTER TABLE master ADD COLUMN IF NOT EXISTS last_call_date timestamp with time zone;
ALTER TABLE master ADD COLUMN IF NOT EXISTS next_call_date timestamp with time zone;
ALTER TABLE master ADD COLUMN IF NOT EXISTS latest_disposition text;
ALTER TABLE master ADD COLUMN IF NOT EXISTS latest_subdisposition text;
ALTER TABLE master ADD COLUMN IF NOT EXISTS activity_name text;

-- Add additional metadata columns
ALTER TABLE master ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE master ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE master ADD COLUMN IF NOT EXISTS source_1 text;
ALTER TABLE master ADD COLUMN IF NOT EXISTS extra text;
ALTER TABLE master ADD COLUMN IF NOT EXISTS extra_1 text;
ALTER TABLE master ADD COLUMN IF NOT EXISTS extra_2 text;
ALTER TABLE master ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE master ADD COLUMN IF NOT EXISTS salutation text;
ALTER TABLE master ADD COLUMN IF NOT EXISTS turnover_link text;
ALTER TABLE master ADD COLUMN IF NOT EXISTS company_linkedin_url text;
ALTER TABLE master ADD COLUMN IF NOT EXISTS associated_member_linkedin text;

-- Create index on id column for better performance
CREATE INDEX IF NOT EXISTS idx_master_id ON master(id);

-- Add comment to document the mirroring
COMMENT ON TABLE master IS 'Master table with columns mirrored from demandcom for seamless data synchronization';