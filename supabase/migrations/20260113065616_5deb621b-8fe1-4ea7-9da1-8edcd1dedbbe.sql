-- Create company_holidays table
CREATE TABLE public.company_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  holiday_date DATE NOT NULL,
  holiday_name TEXT NOT NULL,
  day_of_week TEXT,
  is_optional BOOLEAN DEFAULT false,
  applicable_locations TEXT[] DEFAULT ARRAY['all']::TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(year, holiday_date, holiday_name)
);

-- Create user_optional_holiday_claims table
CREATE TABLE public.user_optional_holiday_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  holiday_id UUID REFERENCES company_holidays(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  claim_type TEXT NOT NULL, -- 'birthday', 'anniversary', 'regional_festival'
  claim_date DATE,
  claimed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, year, claim_type)
);

-- Add location column to profiles if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'Delhi';

-- Add leave limit columns to leave_balances if not exists
ALTER TABLE public.leave_balances 
  ADD COLUMN IF NOT EXISTS maternity_leave_balance NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paternity_leave_balance NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS optional_holidays_claimed INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE public.company_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_optional_holiday_claims ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_holidays
CREATE POLICY "Everyone can view holidays" ON public.company_holidays 
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage holidays" ON public.company_holidays 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- RLS Policies for user_optional_holiday_claims
CREATE POLICY "Users can view their own claims" ON public.user_optional_holiday_claims 
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own claims" ON public.user_optional_holiday_claims 
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own claims" ON public.user_optional_holiday_claims 
  FOR DELETE USING (user_id = auth.uid());

-- Seed 2026 Holiday Data
INSERT INTO public.company_holidays (year, holiday_date, holiday_name, day_of_week, is_optional, applicable_locations, notes) VALUES
-- National Holidays
(2026, '2026-01-01', 'New Year', 'Thursday', false, ARRAY['Delhi', 'Bangaluru', 'Mumbai'], NULL),
(2026, '2026-01-14', 'Makar Sankranti', 'Wednesday', false, ARRAY['Bangaluru'], NULL),
(2026, '2026-01-26', 'Republic Day', 'Monday', false, ARRAY['Delhi', 'Bangaluru', 'Mumbai'], NULL),
(2026, '2026-03-04', 'Holi', 'Wednesday', false, ARRAY['Delhi', 'Mumbai'], NULL),
(2026, '2026-03-19', 'Gudi Padwa/Ugadi', 'Thursday', false, ARRAY['Bangaluru'], NULL),
(2026, '2026-03-21', 'Eid-Ul-Fitr', 'Saturday', false, ARRAY['Bangaluru', 'Mumbai'], NULL),
(2026, '2026-03-26', 'Ram Navami', 'Thursday', false, ARRAY['Delhi'], NULL),
(2026, '2026-08-15', 'Independence Day', 'Saturday', false, ARRAY['Delhi', 'Bangaluru', 'Mumbai'], NULL),
(2026, '2026-08-28', 'Rakshabandhan', 'Friday', false, ARRAY['Delhi'], NULL),
(2026, '2026-09-04', 'Janmashtami', 'Friday', false, ARRAY['Mumbai'], NULL),
(2026, '2026-09-14', 'Ganesh Chaturthi', 'Monday', false, ARRAY['Bangaluru', 'Mumbai'], NULL),
(2026, '2026-10-02', 'Gandhi Jayanti', 'Friday', false, ARRAY['Delhi', 'Bangaluru', 'Mumbai'], NULL),
(2026, '2026-10-20', 'Ayudha Pooja/Dussehra', 'Tuesday', false, ARRAY['Delhi', 'Bangaluru', 'Mumbai'], NULL),
(2026, '2026-11-11', 'Bhai Duj', 'Wednesday', false, ARRAY['Delhi', 'Mumbai'], NULL),
(2026, '2026-12-25', 'Christmas Day', 'Friday', false, ARRAY['Delhi', 'Bangaluru', 'Mumbai'], NULL),
-- Weekend Holidays (for reference)
(2026, '2026-02-15', 'Maha Shivratri', 'Sunday', false, ARRAY['Delhi', 'Bangaluru', 'Mumbai'], 'Falls on Sunday'),
(2026, '2026-11-01', 'Karnataka Day', 'Sunday', false, ARRAY['Bangaluru'], 'Falls on Sunday'),
(2026, '2026-11-08', 'Diwali', 'Sunday', false, ARRAY['Delhi', 'Bangaluru', 'Mumbai'], 'Falls on Sunday')
ON CONFLICT (year, holiday_date, holiday_name) DO NOTHING;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_company_holidays_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_company_holidays_timestamp
  BEFORE UPDATE ON public.company_holidays
  FOR EACH ROW
  EXECUTE FUNCTION update_company_holidays_updated_at();