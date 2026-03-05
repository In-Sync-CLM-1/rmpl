
CREATE OR REPLACE FUNCTION public.calculate_comp_off_days(p_user_id UUID, p_year INT)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comp_off NUMERIC := 0;
  v_rec RECORD;
  v_day_of_week INT;
  v_day_of_month INT;
  v_week_num INT;
  v_is_holiday BOOLEAN;
  v_user_location TEXT;
BEGIN
  SELECT location INTO v_user_location FROM public.profiles WHERE id = p_user_id;

  FOR v_rec IN
    SELECT date, status FROM public.attendance_records
    WHERE user_id = p_user_id
      AND EXTRACT(YEAR FROM date) = p_year
      AND status IN ('present', 'half_day')
  LOOP
    v_day_of_week := EXTRACT(DOW FROM v_rec.date);
    v_day_of_month := EXTRACT(DAY FROM v_rec.date);
    v_week_num := CEIL(v_day_of_month::NUMERIC / 7);

    SELECT EXISTS(
      SELECT 1 FROM public.company_holidays
      WHERE holiday_date = v_rec.date
        AND (is_optional IS NULL OR is_optional = false)
        AND (applicable_locations IS NULL 
             OR v_user_location IS NULL 
             OR v_user_location = ANY(applicable_locations))
    ) INTO v_is_holiday;

    -- Sunday, 2nd/4th Saturday, or holiday → always 1 full comp-off
    IF v_day_of_week = 0 
       OR (v_day_of_week = 6 AND v_week_num IN (2, 4))
       OR v_is_holiday THEN
      v_comp_off := v_comp_off + 1;
    END IF;
  END LOOP;

  RETURN v_comp_off;
END;
$$;
