-- Drop the existing constraint that requires target > 0
ALTER TABLE public.csbd_targets DROP CONSTRAINT csbd_targets_annual_target_inr_lacs_check;

-- Add new constraint allowing 0 or greater
ALTER TABLE public.csbd_targets ADD CONSTRAINT csbd_targets_annual_target_inr_lacs_check CHECK (annual_target_inr_lacs >= 0);