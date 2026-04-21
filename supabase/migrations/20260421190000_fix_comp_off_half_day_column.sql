-- Fix: `leave_applications` has no `half_day` column — it stores fractional
-- days in `total_days` (e.g. 0.5 for a half-day). The auto-recalc trigger
-- added in 20260421000000_auto_recalc_comp_off_on_attendance.sql copied a
-- latent bug from the older `recalculate_all_comp_off`, causing every
-- attendance_records UPDATE (including the 6:30 PM sign-out) to fail with
-- `column la.half_day does not exist`.

CREATE OR REPLACE FUNCTION public.recalculate_comp_off_for_user(p_user_id UUID, p_year INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comp_days NUMERIC;
  v_used NUMERIC;
  v_balance NUMERIC;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.leave_balances WHERE user_id = p_user_id AND year = p_year
  ) THEN
    RETURN;
  END IF;

  v_comp_days := public.calculate_comp_off_days(p_user_id, p_year);

  SELECT COALESCE(SUM(la.total_days), 0) INTO v_used
  FROM public.leave_applications la
  WHERE la.user_id = p_user_id
    AND la.leave_type = 'compensatory_off'
    AND la.status = 'approved'
    AND EXTRACT(YEAR FROM la.start_date) = p_year;

  v_balance := GREATEST(v_comp_days - v_used, 0);

  UPDATE public.leave_balances
  SET compensatory_off_limit = v_comp_days,
      compensatory_off_balance = v_balance,
      updated_at = NOW()
  WHERE user_id = p_user_id AND year = p_year;
END;
$$;

-- Also fix the pre-existing admin "Recalculate Comp Off" function, which had
-- the same bug but was only reachable via a manual button.
CREATE OR REPLACE FUNCTION public.recalculate_all_comp_off(p_year INT)
RETURNS TABLE(user_id UUID, comp_off_days NUMERIC, used_days NUMERIC, new_balance NUMERIC)
AS $$
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

    SELECT COALESCE(SUM(la.total_days), 0) INTO v_used
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
