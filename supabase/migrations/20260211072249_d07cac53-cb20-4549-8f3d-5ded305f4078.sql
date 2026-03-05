
-- 1. Update default values for maternity and paternity leave
ALTER TABLE public.leave_balances 
  ALTER COLUMN maternity_leave_limit SET DEFAULT 180,
  ALTER COLUMN maternity_leave_balance SET DEFAULT 180,
  ALTER COLUMN paternity_leave_limit SET DEFAULT 3,
  ALTER COLUMN paternity_leave_balance SET DEFAULT 3;

-- 2. Update existing records where limits are 0
UPDATE public.leave_balances 
SET maternity_leave_limit = 180, maternity_leave_balance = 180 
WHERE maternity_leave_limit = 0;

UPDATE public.leave_balances 
SET paternity_leave_limit = 3, paternity_leave_balance = 3 
WHERE paternity_leave_limit = 0;

-- 3. Create function to calculate comp-off days
CREATE OR REPLACE FUNCTION public.calculate_comp_off_days(p_user_id UUID, p_year INT)
RETURNS NUMERIC AS $$
DECLARE
  v_comp_off NUMERIC := 0;
  v_rec RECORD;
  v_day_of_week INT;
  v_day_of_month INT;
  v_week_num INT;
  v_is_holiday BOOLEAN;
  v_user_location TEXT;
BEGIN
  -- Get user location for holiday matching
  SELECT location INTO v_user_location FROM public.profiles WHERE id = p_user_id;

  FOR v_rec IN
    SELECT date, status FROM public.attendance_records
    WHERE user_id = p_user_id
      AND EXTRACT(YEAR FROM date) = p_year
      AND status IN ('present', 'half_day')
  LOOP
    v_day_of_week := EXTRACT(DOW FROM v_rec.date); -- 0=Sunday
    v_day_of_month := EXTRACT(DAY FROM v_rec.date);
    v_week_num := CEIL(v_day_of_month::NUMERIC / 7);

    -- Check if it's a company holiday
    SELECT EXISTS(
      SELECT 1 FROM public.company_holidays
      WHERE holiday_date = v_rec.date
        AND (is_optional IS NULL OR is_optional = false)
        AND (applicable_locations IS NULL 
             OR v_user_location IS NULL 
             OR v_user_location = ANY(applicable_locations))
    ) INTO v_is_holiday;

    -- Sunday, 2nd/4th Saturday, or holiday
    IF v_day_of_week = 0 
       OR (v_day_of_week = 6 AND v_week_num IN (2, 4))
       OR v_is_holiday THEN
      IF v_rec.status = 'present' THEN
        v_comp_off := v_comp_off + 1;
      ELSIF v_rec.status = 'half_day' THEN
        v_comp_off := v_comp_off + 0.5;
      END IF;
    END IF;
  END LOOP;

  RETURN v_comp_off;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Create function to recalculate comp-off for all users
CREATE OR REPLACE FUNCTION public.recalculate_all_comp_off(p_year INT)
RETURNS TABLE(user_id UUID, comp_off_days NUMERIC, used_days NUMERIC, new_balance NUMERIC) AS $$
DECLARE
  v_rec RECORD;
  v_comp_days NUMERIC;
  v_used NUMERIC;
  v_balance NUMERIC;
BEGIN
  FOR v_rec IN
    SELECT DISTINCT lb.user_id FROM public.leave_balances lb WHERE lb.year = p_year
  LOOP
    v_comp_days := public.calculate_comp_off_days(v_rec.user_id, p_year);
    
    -- Calculate already used comp-off leaves
    SELECT COALESCE(SUM(
      CASE WHEN la.half_day THEN 0.5 ELSE 
        (la.end_date - la.start_date + 1) 
      END
    ), 0) INTO v_used
    FROM public.leave_applications la
    WHERE la.user_id = v_rec.user_id
      AND la.leave_type = 'compensatory_off'
      AND la.status = 'approved'
      AND EXTRACT(YEAR FROM la.start_date) = p_year;

    v_balance := GREATEST(v_comp_days - v_used, 0);

    UPDATE public.leave_balances lb
    SET compensatory_off_limit = v_comp_days,
        compensatory_off_balance = v_balance
    WHERE lb.user_id = v_rec.user_id AND lb.year = p_year;

    user_id := v_rec.user_id;
    comp_off_days := v_comp_days;
    used_days := v_used;
    new_balance := v_balance;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
