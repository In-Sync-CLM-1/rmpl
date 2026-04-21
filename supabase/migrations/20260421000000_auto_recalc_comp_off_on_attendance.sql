-- Auto-recalculate comp-off whenever attendance_records change.
-- Previously comp-off was only updated via the manual "Recalculate Comp Off"
-- admin button, so presence on a 2nd/4th Saturday or holiday would not bump
-- the balance until someone remembered to click it.

-- Per-user variant of recalculate_all_comp_off
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

  SELECT COALESCE(SUM(
    CASE WHEN la.half_day THEN 0.5 ELSE
      (la.end_date - la.start_date + 1)
    END
  ), 0) INTO v_used
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

CREATE OR REPLACE FUNCTION public.trg_attendance_recalc_comp_off()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_year INT;
  v_new_year INT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_comp_off_for_user(OLD.user_id, EXTRACT(YEAR FROM OLD.date)::INT);
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.recalculate_comp_off_for_user(NEW.user_id, EXTRACT(YEAR FROM NEW.date)::INT);
    RETURN NEW;
  ELSE
    v_old_year := EXTRACT(YEAR FROM OLD.date)::INT;
    v_new_year := EXTRACT(YEAR FROM NEW.date)::INT;
    IF OLD.user_id IS DISTINCT FROM NEW.user_id OR v_old_year IS DISTINCT FROM v_new_year THEN
      PERFORM public.recalculate_comp_off_for_user(OLD.user_id, v_old_year);
    END IF;
    PERFORM public.recalculate_comp_off_for_user(NEW.user_id, v_new_year);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS attendance_recalc_comp_off ON public.attendance_records;
CREATE TRIGGER attendance_recalc_comp_off
AFTER INSERT OR UPDATE OR DELETE ON public.attendance_records
FOR EACH ROW
EXECUTE FUNCTION public.trg_attendance_recalc_comp_off();

-- Backfill: run a full recalc for the current and previous year so any
-- already-recorded presence on Sundays/2nd-4th Saturdays/holidays is picked up.
SELECT public.recalculate_all_comp_off(EXTRACT(YEAR FROM CURRENT_DATE)::INT);
SELECT public.recalculate_all_comp_off((EXTRACT(YEAR FROM CURRENT_DATE) - 1)::INT);
