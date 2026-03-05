-- Create a view that returns only the latest record per mobile_numb
-- This is used by the sync-demandcom-to-master function to ensure
-- the master table contains the most recent information for each participant

CREATE OR REPLACE VIEW public.demandcom_latest_per_mobile AS
SELECT DISTINCT ON (mobile_numb) *
FROM public.demandcom
WHERE mobile_numb IS NOT NULL 
  AND mobile_numb != ''
  AND name IS NOT NULL 
  AND name != ''
ORDER BY mobile_numb, updated_at DESC NULLS LAST, created_at DESC NULLS LAST;