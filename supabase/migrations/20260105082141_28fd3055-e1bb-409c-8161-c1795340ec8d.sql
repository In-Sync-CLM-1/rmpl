-- Drop the existing check constraint
ALTER TABLE demandcom_daily_targets DROP CONSTRAINT demandcom_daily_targets_campaign_type_check;

-- Add new check constraint that includes 'combined'
ALTER TABLE demandcom_daily_targets ADD CONSTRAINT demandcom_daily_targets_campaign_type_check 
CHECK (campaign_type = ANY (ARRAY['online'::text, 'offline'::text, 'combined'::text]));