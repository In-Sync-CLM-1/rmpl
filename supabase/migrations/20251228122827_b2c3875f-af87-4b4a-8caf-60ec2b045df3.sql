
-- Create function to record daily activity
CREATE OR REPLACE FUNCTION public.record_daily_activity(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_daily_activity (user_id, activity_date, has_activity)
  VALUES (p_user_id, CURRENT_DATE, true)
  ON CONFLICT (user_id, activity_date)
  DO UPDATE SET has_activity = true;
END;
$$;

-- Create function to award points
CREATE OR REPLACE FUNCTION public.award_points(
  p_user_id UUID,
  p_activity_type TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points INTEGER;
  v_is_active BOOLEAN;
BEGIN
  -- Get points value for activity type
  SELECT points_value, is_active INTO v_points, v_is_active
  FROM point_activity_types
  WHERE activity_type = p_activity_type;
  
  IF v_points IS NULL OR NOT v_is_active THEN
    RETURN 0;
  END IF;
  
  -- Insert point record
  INSERT INTO user_points (user_id, points, activity_type, reference_id, description)
  VALUES (p_user_id, v_points, p_activity_type, p_reference_id, p_description);
  
  RETURN v_points;
END;
$$;

-- Create function to calculate star tier
CREATE OR REPLACE FUNCTION public.calculate_star_tier(p_points INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_points >= 500 THEN
    RETURN 'platinum';
  ELSIF p_points >= 300 THEN
    RETURN 'gold';
  ELSIF p_points >= 150 THEN
    RETURN 'silver';
  ELSIF p_points >= 50 THEN
    RETURN 'bronze';
  ELSE
    RETURN 'none';
  END IF;
END;
$$;

-- Create function to update monthly summary
CREATE OR REPLACE FUNCTION public.update_monthly_summary(p_user_id UUID, p_month_year TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month TEXT;
  v_total_points INTEGER;
  v_team_id UUID;
  v_star_tier TEXT;
BEGIN
  v_month := COALESCE(p_month_year, to_char(now(), 'YYYY-MM'));
  
  -- Calculate total points for the month
  SELECT COALESCE(SUM(points), 0) INTO v_total_points
  FROM user_points
  WHERE user_id = p_user_id AND month_year = v_month;
  
  -- Get user's team
  SELECT team_id INTO v_team_id
  FROM team_members
  WHERE user_id = p_user_id
  LIMIT 1;
  
  -- Calculate star tier
  v_star_tier := calculate_star_tier(v_total_points);
  
  -- Upsert monthly summary
  INSERT INTO monthly_point_summaries (user_id, team_id, month_year, total_points, star_tier)
  VALUES (p_user_id, v_team_id, v_month, v_total_points, v_star_tier)
  ON CONFLICT (user_id, month_year)
  DO UPDATE SET
    total_points = v_total_points,
    star_tier = v_star_tier,
    team_id = v_team_id,
    updated_at = now();
END;
$$;

-- Create trigger to update summary when points change
CREATE OR REPLACE FUNCTION public.trigger_update_monthly_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM update_monthly_summary(NEW.user_id, NEW.month_year);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_points_insert ON public.user_points;
CREATE TRIGGER after_points_insert
AFTER INSERT ON public.user_points
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_monthly_summary();

-- Create trigger for attendance sign-in points
CREATE OR REPLACE FUNCTION public.trigger_attendance_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.sign_in_time IS NOT NULL THEN
    PERFORM award_points(NEW.user_id, 'attendance_signin', NEW.id, 'Attendance sign-in');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_attendance_insert ON public.attendance_records;
CREATE TRIGGER after_attendance_insert
AFTER INSERT ON public.attendance_records
FOR EACH ROW
EXECUTE FUNCTION public.trigger_attendance_points();

-- Create trigger for task completion points
CREATE OR REPLACE FUNCTION public.trigger_task_completion_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    PERFORM award_points(NEW.assigned_to, 'task_completed', NEW.id, 'Task completed: ' || NEW.task_name);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_task_status_update ON public.general_tasks;
CREATE TRIGGER after_task_status_update
AFTER INSERT OR UPDATE OF status ON public.general_tasks
FOR EACH ROW
EXECUTE FUNCTION public.trigger_task_completion_points();

-- Create trigger for announcement view points
CREATE OR REPLACE FUNCTION public.trigger_announcement_view_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE(NEW.points_awarded, false) THEN
    PERFORM award_points(NEW.user_id, 'announcement_read', NEW.announcement_id, 'Read announcement');
    UPDATE user_announcement_views SET points_awarded = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_announcement_view ON public.user_announcement_views;
CREATE TRIGGER after_announcement_view
AFTER INSERT ON public.user_announcement_views
FOR EACH ROW
EXECUTE FUNCTION public.trigger_announcement_view_points();
