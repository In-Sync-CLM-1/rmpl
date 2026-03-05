-- Add social media link columns to email_templates table
ALTER TABLE email_templates
ADD COLUMN facebook_url TEXT,
ADD COLUMN twitter_url TEXT,
ADD COLUMN linkedin_url TEXT,
ADD COLUMN instagram_url TEXT;