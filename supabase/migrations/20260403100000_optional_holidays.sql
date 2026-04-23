-- Add pre-defined optional holidays for 2026
INSERT INTO public.company_holidays (year, holiday_date, holiday_name, day_of_week, is_optional, applicable_locations, notes) VALUES
(2026, '2026-01-13', 'Lohri', 'Tuesday', true, ARRAY['Delhi'], 'Optional Holiday'),
(2026, '2026-04-03', 'Good Friday', 'Friday', true, ARRAY['Delhi', 'Bangaluru', 'Mumbai'], 'Optional Holiday'),
(2026, '2026-05-01', 'May Day', 'Friday', true, ARRAY['Bangaluru', 'Mumbai'], 'Optional Holiday'),
(2026, '2026-12-24', 'Christmas Eve', 'Thursday', true, ARRAY['Delhi', 'Bangaluru', 'Mumbai'], 'Optional Holiday')
ON CONFLICT (year, holiday_date, holiday_name) DO NOTHING;

-- Fix unique constraint on user_optional_holiday_claims to support pre-defined holiday avails
-- Old constraint: (user_id, year, claim_type) - prevents claiming two pre-defined holidays
-- New: separate partial indexes for personal claims vs holiday avails
ALTER TABLE public.user_optional_holiday_claims
  DROP CONSTRAINT IF EXISTS user_optional_holiday_claims_user_id_year_claim_type_key;

-- Personal claims (birthday, anniversary, regional_festival) - one per type per year
CREATE UNIQUE INDEX IF NOT EXISTS uohc_personal_claim_unique
  ON public.user_optional_holiday_claims (user_id, year, claim_type)
  WHERE holiday_id IS NULL;

-- Pre-defined holiday avails - one per holiday per year
CREATE UNIQUE INDEX IF NOT EXISTS uohc_holiday_avail_unique
  ON public.user_optional_holiday_claims (user_id, year, holiday_id)
  WHERE holiday_id IS NOT NULL;
