-- Add missing updated_at column to sync_logs
-- Required by sync-demandcom-to-master edge function for activity tracking and stale sync detection
ALTER TABLE sync_logs ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Recreate the demandcom_latest_per_mobile view (was dropped at some point)
CREATE OR REPLACE VIEW public.demandcom_latest_per_mobile AS
SELECT DISTINCT ON (mobile_numb) *
FROM public.demandcom
WHERE mobile_numb IS NOT NULL
  AND mobile_numb != ''
  AND name IS NOT NULL
  AND name != ''
ORDER BY mobile_numb, updated_at DESC NULLS LAST, created_at DESC NULLS LAST;

-- Grant access to the view
GRANT SELECT ON public.demandcom_latest_per_mobile TO authenticated;
GRANT SELECT ON public.demandcom_latest_per_mobile TO service_role;
