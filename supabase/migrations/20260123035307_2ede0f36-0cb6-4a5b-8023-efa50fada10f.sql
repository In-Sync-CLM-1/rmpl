-- Create table for late coming records (if not exists)
CREATE TABLE IF NOT EXISTS public.late_coming_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attendance_record_id UUID REFERENCES attendance_records(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  sign_in_time TIMESTAMPTZ NOT NULL,
  expected_time TIME DEFAULT '09:30:00',
  late_minutes INTEGER NOT NULL,
  month_year TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.late_coming_records ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own late records" ON public.late_coming_records;
DROP POLICY IF EXISTS "System can insert late records" ON public.late_coming_records;
DROP POLICY IF EXISTS "Admins can view all late records" ON public.late_coming_records;
DROP POLICY IF EXISTS "Managers can view reportee late records" ON public.late_coming_records;

-- Create policies
CREATE POLICY "Users can view their own late records"
ON public.late_coming_records FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert late records"
ON public.late_coming_records FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can view all late records"
ON public.late_coming_records FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('platform_admin', 'super_admin', 'admin_tech', 'admin')
  )
);

CREATE POLICY "Managers can view reportee late records"
ON public.late_coming_records FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = late_coming_records.user_id
    AND reports_to = auth.uid()
  )
);

-- Create or replace the late coming detection trigger
CREATE OR REPLACE FUNCTION public.record_late_coming()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sign_in_time TIME;
  v_expected_time TIME := '09:30:00';
  v_late_minutes INTEGER;
  v_month_year TEXT;
BEGIN
  IF NEW.sign_in_time IS NULL THEN
    RETURN NEW;
  END IF;

  v_sign_in_time := (NEW.sign_in_time AT TIME ZONE 'Asia/Kolkata')::TIME;
  
  IF v_sign_in_time > v_expected_time THEN
    v_late_minutes := EXTRACT(EPOCH FROM (v_sign_in_time - v_expected_time)) / 60;
    v_month_year := TO_CHAR(NEW.date, 'YYYY-MM');
    
    INSERT INTO late_coming_records (
      user_id, attendance_record_id, date, sign_in_time, expected_time, late_minutes, month_year
    ) VALUES (
      NEW.user_id, NEW.id, NEW.date, NEW.sign_in_time, v_expected_time, v_late_minutes, v_month_year
    )
    ON CONFLICT (user_id, date) DO UPDATE SET
      sign_in_time = EXCLUDED.sign_in_time,
      late_minutes = EXCLUDED.late_minutes,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS detect_late_coming ON attendance_records;
CREATE TRIGGER detect_late_coming
AFTER INSERT OR UPDATE OF sign_in_time ON attendance_records
FOR EACH ROW
EXECUTE FUNCTION record_late_coming();