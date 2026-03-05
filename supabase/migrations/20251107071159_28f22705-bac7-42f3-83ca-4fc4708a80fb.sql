-- Add new fields to demandcom table
ALTER TABLE demandcom
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS source text,
ADD COLUMN IF NOT EXISTS source_1 text,
ADD COLUMN IF NOT EXISTS extra text,
ADD COLUMN IF NOT EXISTS extra_1 text,
ADD COLUMN IF NOT EXISTS extra_2 text,
ADD COLUMN IF NOT EXISTS user_id text,
ADD COLUMN IF NOT EXISTS salutation text,
ADD COLUMN IF NOT EXISTS turnover_link text,
ADD COLUMN IF NOT EXISTS company_linkedin_url text,
ADD COLUMN IF NOT EXISTS associated_member_linkedin text;