const https = require('https');

const PROJECT_REF = 'ltlvhmwrrsromwuiybwu';
const SBP_TOKEN = 'sbp_68e70c187e18c25ba82fc27a13585372ef8c7ad2';

// Fix 1: get_personal_dashboard v1 - change general_tasks → tasks
// Fix 2: send_task_assignment_email - change project_tasks → tasks
const sql = `
-- Fix get_personal_dashboard: general_tasks → tasks
CREATE OR REPLACE FUNCTION get_personal_dashboard(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func1$
DECLARE
  v_result JSONB;
  v_is_admin BOOLEAN;
  v_today DATE := CURRENT_DATE;
  v_month_start DATE := date_trunc('month', CURRENT_DATE)::date;
  v_month_end DATE := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date;
  v_week_start DATE := date_trunc('week', CURRENT_DATE)::date;
  v_week_end DATE := (date_trunc('week', CURRENT_DATE) + interval '6 days')::date;
  v_year INT := extract(year from CURRENT_DATE)::int;
  v_projects_completed INT := 0;
  v_projects_in_progress INT := 0;
  v_total_projects INT := 0;
  v_tasks_assigned INT := 0;
  v_tasks_pending INT := 0;
  v_tasks_overdue INT := 0;
  v_tasks_completed_month INT := 0;
  v_att_present INT := 0;
  v_att_half_day INT := 0;
  v_att_absent INT := 0;
  v_att_total INT := 0;
  v_today_signed_in BOOLEAN := false;
  v_today_sign_in TEXT := null;
  v_today_sign_out TEXT := null;
  v_casual_leave NUMERIC := 0;
  v_earned_leave NUMERIC := 0;
  v_leave_applied INT := 0;
  v_calls_today INT := 0;
  v_calls_week INT := 0;
  v_calls_month INT := 0;
  v_scheduled_calls INT := 0;
  v_daily_call_target INT := 0;
  v_daily_reg_target INT := 0;
  v_monthly_call_target INT := 0;
  v_monthly_reg_target INT := 0;
  v_daily_reg_achieved INT := 0;
  v_monthly_reg_achieved INT := 0;
  v_assigned_records INT := 0;
  v_untouched_records INT := 0;
  v_called_records INT := 0;
  v_positive_dispositions INT := 0;
  v_daily_calls JSONB := '[]'::jsonb;
  v_leaderboard JSONB := '[]'::jsonb;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id
    AND role IN ('platform_admin', 'super_admin', 'admin', 'admin_administration', 'admin_tech')
  ) INTO v_is_admin;

  IF v_is_admin THEN
    SELECT
      COUNT(*) FILTER (WHERE status IN ('closed', 'closed_won')),
      COUNT(*) FILTER (WHERE status NOT IN ('closed', 'closed_won', 'closed_lost', 'lost')),
      COUNT(*)
    INTO v_projects_completed, v_projects_in_progress, v_total_projects
    FROM projects;
  ELSE
    WITH user_projects AS (
      SELECT DISTINCT p.id, p.status
      FROM projects p
      LEFT JOIN project_team_members ptm ON ptm.project_id = p.id AND ptm.user_id = p_user_id
      WHERE ptm.user_id IS NOT NULL OR p.created_by = p_user_id
    )
    SELECT
      COUNT(*) FILTER (WHERE status IN ('closed', 'closed_won')),
      COUNT(*) FILTER (WHERE status NOT IN ('closed', 'closed_won', 'closed_lost', 'lost')),
      COUNT(*)
    INTO v_projects_completed, v_projects_in_progress, v_total_projects
    FROM user_projects;
  END IF;

  -- Tasks (unified tasks table)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress')),
    COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress') AND due_date < v_today),
    COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= v_month_start)
  INTO v_tasks_assigned, v_tasks_pending, v_tasks_overdue, v_tasks_completed_month
  FROM tasks
  WHERE assigned_to = p_user_id;

  SELECT
    COUNT(*) FILTER (WHERE status = 'present'),
    COUNT(*) FILTER (WHERE status = 'half_day'),
    COUNT(*) FILTER (WHERE status = 'absent'),
    COUNT(*)
  INTO v_att_present, v_att_half_day, v_att_absent, v_att_total
  FROM attendance_records
  WHERE user_id = p_user_id AND date >= v_month_start AND date <= v_month_end;

  SELECT
    sign_in_time IS NOT NULL,
    sign_in_time::text,
    sign_out_time::text
  INTO v_today_signed_in, v_today_sign_in, v_today_sign_out
  FROM attendance_records
  WHERE user_id = p_user_id AND date = v_today
  LIMIT 1;

  SELECT casual_leave_balance, earned_leave_balance
  INTO v_casual_leave, v_earned_leave
  FROM leave_balances
  WHERE user_id = p_user_id AND year = v_year
  LIMIT 1;

  SELECT COUNT(*) INTO v_leave_applied
  FROM leave_applications
  WHERE user_id = p_user_id;

  SELECT
    COUNT(*) FILTER (WHERE created_at::date = v_today),
    COUNT(*) FILTER (WHERE created_at::date >= v_week_start AND created_at::date <= v_week_end),
    COUNT(*)
  INTO v_calls_today, v_calls_week, v_calls_month
  FROM call_logs
  WHERE initiated_by = p_user_id AND created_at >= v_month_start;

  SELECT COALESCE(jsonb_agg(row_to_json(d)::jsonb ORDER BY d.date), '[]'::jsonb)
  INTO v_daily_calls
  FROM (
    SELECT
      ds.d::date::text AS date,
      COUNT(cl.id) AS calls
    FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day'::interval) ds(d)
    LEFT JOIN call_logs cl ON cl.initiated_by = p_user_id AND cl.created_at::date = ds.d::date
    GROUP BY ds.d
  ) d;

  SELECT COALESCE(call_target, 0), COALESCE(registration_target, 0)
  INTO v_daily_call_target, v_daily_reg_target
  FROM demandcom_daily_targets
  WHERE user_id = p_user_id AND target_date = v_today
  LIMIT 1;

  SELECT COALESCE(SUM(call_target), 0), COALESCE(SUM(registration_target), 0)
  INTO v_monthly_call_target, v_monthly_reg_target
  FROM demandcom_daily_targets
  WHERE user_id = p_user_id AND target_date >= v_month_start AND target_date <= v_month_end;

  SELECT
    COUNT(*) FILTER (WHERE created_at::date = v_today AND disposition ILIKE '%interested%'),
    COUNT(*) FILTER (WHERE disposition ILIKE '%interested%')
  INTO v_daily_reg_achieved, v_monthly_reg_achieved
  FROM call_logs
  WHERE initiated_by = p_user_id AND created_at >= v_month_start;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE last_call_date IS NULL),
    COUNT(*) FILTER (WHERE last_call_date IS NOT NULL),
    COUNT(*) FILTER (WHERE latest_disposition ILIKE ANY(ARRAY['%interested%', '%hot lead%', '%callback%', '%meeting scheduled%']))
  INTO v_assigned_records, v_untouched_records, v_called_records, v_positive_dispositions
  FROM demandcom
  WHERE assigned_to = p_user_id;

  SELECT COUNT(*) INTO v_scheduled_calls
  FROM demandcom
  WHERE assigned_to = p_user_id
    AND next_call_date >= v_today::timestamp
    AND next_call_date < (v_today + 1)::timestamp;

  SELECT COALESCE(jsonb_agg(lb ORDER BY lb.rank), '[]'::jsonb)
  INTO v_leaderboard
  FROM (
    SELECT
      sub.user_id AS "userId",
      sub.user_name AS "userName",
      sub.calls,
      sub.registrations,
      ROW_NUMBER() OVER (ORDER BY sub.registrations DESC, sub.calls DESC) AS rank
    FROM (
      SELECT
        COALESCE(c.changed_by, r.assigned_to) AS user_id,
        p.full_name AS user_name,
        COALESCE(c.call_count, 0) AS calls,
        COALESCE(r.reg_count, 0) AS registrations
      FROM (
        SELECT changed_by, COUNT(*) AS call_count
        FROM demandcom_field_changes
        WHERE field_name = 'disposition'
          AND changed_at >= v_month_start
          AND changed_by IS NOT NULL
        GROUP BY changed_by
      ) c
      FULL OUTER JOIN (
        SELECT assigned_to, COUNT(*) AS reg_count
        FROM demandcom
        WHERE latest_subdisposition = 'Registered'
          AND updated_at >= v_month_start::timestamp
          AND assigned_to IS NOT NULL
        GROUP BY assigned_to
      ) r ON c.changed_by = r.assigned_to
      JOIN profiles p ON p.id = COALESCE(c.changed_by, r.assigned_to)
    ) sub
    ORDER BY sub.registrations DESC, sub.calls DESC
    LIMIT 5
  ) lb;

  v_result := jsonb_build_object(
    'projectsCompleted', v_projects_completed,
    'projectsInProgress', v_projects_in_progress,
    'totalProjectsAssigned', v_total_projects,
    'tasksAssigned', v_tasks_assigned,
    'tasksPending', v_tasks_pending,
    'tasksOverdue', v_tasks_overdue,
    'tasksCompletedThisMonth', v_tasks_completed_month,
    'attendanceThisMonth', jsonb_build_object(
      'present', v_att_present, 'halfDay', v_att_half_day,
      'absent', v_att_absent, 'totalDays', v_att_total
    ),
    'todayAttendance', jsonb_build_object(
      'signedIn', COALESCE(v_today_signed_in, false),
      'signInTime', v_today_sign_in,
      'signOutTime', v_today_sign_out
    ),
    'leaveBalance', jsonb_build_object(
      'casualLeave', COALESCE(v_casual_leave, 0),
      'earnedLeave', COALESCE(v_earned_leave, 0),
      'totalUsed', (12 - COALESCE(v_casual_leave, 12)) + (15 - COALESCE(v_earned_leave, 15))
    ),
    'leaveApplied', v_leave_applied,
    'callsToday', v_calls_today,
    'callsThisWeek', v_calls_week,
    'callsThisMonth', v_calls_month,
    'dailyCallsData', v_daily_calls,
    'scheduledCallsToday', v_scheduled_calls,
    'dailyTarget', jsonb_build_object(
      'callTarget', v_daily_call_target,
      'callsAchieved', v_calls_today,
      'registrationTarget', v_daily_reg_target,
      'registrationsAchieved', v_daily_reg_achieved
    ),
    'monthlyTarget', jsonb_build_object(
      'callTarget', v_monthly_call_target,
      'callsAchieved', v_calls_month,
      'registrationTarget', v_monthly_reg_target,
      'registrationsAchieved', v_monthly_reg_achieved
    ),
    'assignedRecords', v_assigned_records,
    'untouchedRecords', v_untouched_records,
    'calledRecords', v_called_records,
    'positiveDispositions', v_positive_dispositions,
    'leaderboard', v_leaderboard
  );

  RETURN v_result;
END;
$func1$;

-- Fix send_task_assignment_email: project_tasks → tasks
CREATE OR REPLACE FUNCTION send_task_assignment_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func2$
DECLARE
  task_data RECORD;
  assigned_user_data RECORD;
  assigned_by_data RECORD;
  supabase_url TEXT := 'https://xbrinligpvtfpqkkllfl.supabase.co';
  supabase_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhicmlubGlncHZ0ZnBxa2tsbGZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNDM4MTIsImV4cCI6MjA3NTcxOTgxMn0.qQriBXjWb5AIc0h4rBxnkpI2J2tbfj9TGsXOPse_Bnc';
BEGIN
  IF (TG_OP = 'INSERT') OR (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.assigned_by THEN
      SELECT * INTO task_data FROM tasks WHERE id = NEW.id;

      SELECT email, full_name INTO assigned_user_data
      FROM profiles WHERE id = NEW.assigned_to;

      SELECT full_name INTO assigned_by_data
      FROM profiles WHERE id = NEW.assigned_by;

      IF assigned_user_data.email IS NOT NULL THEN
        PERFORM net.http_post(
          url := supabase_url || '/functions/v1/send-task-notification-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || supabase_anon_key
          ),
          body := jsonb_build_object(
            'user_id', NEW.assigned_to,
            'task_id', NEW.id,
            'notification_type', 'task_assigned',
            'task_name', task_data.task_name,
            'due_date', task_data.due_date,
            'assigned_by_name', assigned_by_data.full_name
          )
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$func2$;

-- Ensure the trigger is on the tasks table (not old project_tasks)
DROP TRIGGER IF EXISTS on_task_assignment ON tasks;
CREATE TRIGGER on_task_assignment
  AFTER INSERT OR UPDATE OF assigned_to ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION send_task_assignment_email();
`;

const body = JSON.stringify({ query: sql });

const options = {
  hostname: 'api.supabase.com',
  path: `/v1/projects/${PROJECT_REF}/database/query`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SBP_TOKEN}`,
    'Content-Length': Buffer.byteLength(body),
  },
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
    } catch {
      console.log(data);
    }
  });
});

req.on('error', (err) => console.error('Request error:', err.message));
req.write(body);
req.end();
