-- Add new columns for bifurcated targets
ALTER TABLE csbd_targets
ADD COLUMN existing_business_target_inr_lacs numeric DEFAULT 0,
ADD COLUMN new_business_target_inr_lacs numeric DEFAULT 0;

-- Migrate existing data (current target becomes existing business by default)
UPDATE csbd_targets 
SET existing_business_target_inr_lacs = COALESCE(annual_target_inr_lacs, 0),
    new_business_target_inr_lacs = 0;