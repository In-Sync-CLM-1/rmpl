
-- Create the calculate_sandwich_leave_days RPC function
-- This function calculates sandwich leave days between two dates,
-- detecting weekends/holidays sandwiched between leave days.
CREATE OR REPLACE FUNCTION public.calculate_sandwich_leave_days(
  p_start_date DATE,
  p_end_date DATE,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requested_days INT := 0;
  v_weekend_days INT := 0;
  v_holiday_days INT := 0;
  v_total_deduction INT := 0;
  v_current_date DATE;
  v_day_of_week INT;
  v_week_of_month INT;
  v_is_weekend BOOLEAN;
  v_is_holiday BOOLEAN;
  v_user_location TEXT;
  v_weekend_dates JSONB := '[]'::JSONB;
  v_holiday_dates JSONB := '[]'::JSONB;
  v_has_sandwich BOOLEAN := FALSE;
  v_gap_start DATE;
  v_gap_end DATE;
BEGIN
  -- Get user location for holiday matching
  IF p_user_id IS NOT NULL THEN
    SELECT location INTO v_user_location FROM profiles WHERE id = p_user_id;
  END IF;

  -- Count requested working days and identify gaps
  v_current_date := p_start_date;
  WHILE v_current_date <= p_end_date LOOP
    v_day_of_week := EXTRACT(DOW FROM v_current_date)::INT; -- 0=Sun, 6=Sat
    v_week_of_month := CEIL(EXTRACT(DAY FROM v_current_date)::INT / 7.0)::INT;

    -- Check if weekend (Sunday or 2nd/4th Saturday)
    v_is_weekend := (v_day_of_week = 0) OR 
                    (v_day_of_week = 6 AND v_week_of_month IN (2, 4));

    -- Check if company holiday
    v_is_holiday := EXISTS (
      SELECT 1 FROM company_holidays ch
      WHERE ch.holiday_date = v_current_date
        AND (ch.is_optional IS NULL OR ch.is_optional = FALSE)
        AND (
          ch.applicable_locations IS NULL 
          OR array_length(ch.applicable_locations, 1) IS NULL
          OR v_user_location IS NULL
          OR v_user_location = ANY(ch.applicable_locations)
        )
    );

    IF v_is_weekend OR v_is_holiday THEN
      -- This is a non-working day within the leave range — it's sandwiched
      v_has_sandwich := TRUE;
      IF v_is_weekend THEN
        v_weekend_days := v_weekend_days + 1;
        v_weekend_dates := v_weekend_dates || to_jsonb(v_current_date::TEXT);
      END IF;
      IF v_is_holiday AND NOT v_is_weekend THEN
        v_holiday_days := v_holiday_days + 1;
        v_holiday_dates := v_holiday_dates || to_jsonb(v_current_date::TEXT);
      END IF;
    ELSE
      v_requested_days := v_requested_days + 1;
    END IF;

    v_current_date := v_current_date + 1;
  END LOOP;

  v_total_deduction := v_requested_days + v_weekend_days + v_holiday_days;

  RETURN jsonb_build_object(
    'requested_days', v_requested_days,
    'weekend_days', v_weekend_days,
    'holiday_days', v_holiday_days,
    'total_deduction', v_total_deduction,
    'has_sandwich', v_has_sandwich,
    'weekend_dates', v_weekend_dates,
    'holiday_dates', v_holiday_dates
  );
END;
$$;
