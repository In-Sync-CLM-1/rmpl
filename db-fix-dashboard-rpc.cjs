const https = require('https');

const PROJECT_REF = 'ltlvhmwrrsromwuiybwu';
const SBP_TOKEN = 'sbp_68e70c187e18c25ba82fc27a13585372ef8c7ad2';

const sql = `
CREATE OR REPLACE FUNCTION get_personal_dashboard_v2(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
  v_yesterday DATE := v_today - 1;
  v_week_start DATE := date_trunc('week', v_today)::date;
  v_month_start DATE := date_trunc('month', v_today)::date;
  v_month_end DATE := (date_trunc('month', v_today) + interval '1 month' - interval '1 day')::date;
  v_prev_month_start DATE := (date_trunc('month', v_today) - interval '1 month')::date;
  v_prev_month_end DATE := v_month_start - 1;
  v_year INT := extract(year from v_today)::int;

  -- User info
  v_user_name TEXT;
  v_is_demandcom BOOLEAN := false;
  v_is_admin BOOLEAN := false;
  v_is_manager BOOLEAN := false;

  -- Today
  v_sign_in_time TIMESTAMPTZ;
  v_sign_out_time TIMESTAMPTZ;
  v_total_hours NUMERIC := 0;
  v_is_late BOOLEAN := false;
  v_calls_today INT := 0;
  v_call_target_today INT := 0;
  v_reg_target_today INT := 0;
  v_db_update_target_today INT := 0;
  v_regs_today INT := 0;
  v_db_updates_today INT := 0;
  v_scheduled_calls_today INT := 0;
  v_scheduled_calls_list JSONB := '[]'::jsonb;

  -- Yesterday
  v_calls_yesterday INT := 0;
  v_connected_yesterday INT := 0;
  v_regs_yesterday INT := 0;
  v_db_updates_yesterday INT := 0;
  v_target_achievement_yesterday NUMERIC := 0;
  v_connected_rate_yesterday NUMERIC := 0;
  v_avg_duration_yesterday NUMERIC := 0;
  v_call_target_yesterday INT := 0;

  -- Week
  v_weekly_breakdown JSONB := '[]'::jsonb;
  v_weekly_call_target INT := 0;
  v_weekly_calls_achieved INT := 0;
  v_weekly_reg_target INT := 0;
  v_weekly_regs_achieved INT := 0;
  v_tasks_completed_week INT := 0;
  v_calls_this_week INT := 0;

  -- Month
  v_att_present INT := 0;
  v_att_half_day INT := 0;
  v_att_absent INT := 0;
  v_att_total_days INT := 0;
  v_late_arrivals INT := 0;
  v_prev_att_present INT := 0;
  v_prev_att_half_day INT := 0;
  v_prev_att_total INT := 0;
  v_reg_pending INT := 0;
  v_reg_approved INT := 0;
  v_reg_rejected INT := 0;
  v_leaves_taken_month NUMERIC := 0;
  v_upcoming_leaves INT := 0;
  v_leave_cl NUMERIC := 0;
  v_leave_el NUMERIC := 0;
  v_monthly_call_target INT := 0;
  v_monthly_calls_achieved INT := 0;
  v_monthly_reg_target INT := 0;
  v_monthly_regs_achieved INT := 0;
  v_calls_this_month INT := 0;
  v_leaderboard_rank INT := 0;
  v_leaderboard_rank_change INT := 0;
  v_tasks_assigned INT := 0;
  v_tasks_completed INT := 0;
  v_tasks_overdue INT := 0;
  v_projects_completed INT := 0;
  v_projects_in_progress INT := 0;
  v_total_projects INT := 0;

  -- Data
  v_assigned_records INT := 0;
  v_untouched_records INT := 0;
  v_called_records INT := 0;
  v_positive_dispositions INT := 0;

  -- Aggregates
  v_leaderboard JSONB := '[]'::jsonb;
  v_pending_tasks JSONB := '[]'::jsonb;
  v_daily_calls_data JSONB := '[]'::jsonb;
BEGIN
  ------------------------------------------------
  -- USER INFO & ROLES
  ------------------------------------------------
  SELECT full_name INTO v_user_name FROM profiles WHERE id = p_user_id;

  SELECT (
    EXISTS(SELECT 1 FROM user_roles WHERE user_id = p_user_id AND role = 'agent')
    OR EXISTS(SELECT 1 FROM demandcom WHERE assigned_to = p_user_id LIMIT 1)
  ) INTO v_is_demandcom;

  SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = p_user_id
    AND role IN ('platform_admin','super_admin','admin','admin_administration','admin_tech'))
  INTO v_is_admin;

  SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = p_user_id
    AND role IN ('manager','leadership'))
  INTO v_is_manager;

  ------------------------------------------------
  -- TODAY'S ATTENDANCE
  ------------------------------------------------
  SELECT sign_in_time, sign_out_time, COALESCE(total_hours, 0)
  INTO v_sign_in_time, v_sign_out_time, v_total_hours
  FROM attendance_records
  WHERE user_id = p_user_id AND date = v_today
  LIMIT 1;

  IF v_sign_in_time IS NOT NULL THEN
    v_is_late := (v_sign_in_time AT TIME ZONE 'Asia/Kolkata')::time > '10:15:00'::time;
  END IF;

  ------------------------------------------------
  -- CALLS TODAY / WEEK / MONTH
  ------------------------------------------------
  SELECT
    COUNT(*) FILTER (WHERE (cl.created_at AT TIME ZONE 'Asia/Kolkata')::date = v_today),
    COUNT(*) FILTER (WHERE (cl.created_at AT TIME ZONE 'Asia/Kolkata')::date >= v_week_start),
    COUNT(*)
  INTO v_calls_today, v_calls_this_week, v_calls_this_month
  FROM call_logs cl
  WHERE cl.initiated_by = p_user_id
    AND cl.created_at >= v_month_start::timestamp;

  ------------------------------------------------
  -- TODAY'S TARGETS
  ------------------------------------------------
  SELECT COALESCE(call_target,0), COALESCE(registration_target,0), COALESCE(database_update_target,0)
  INTO v_call_target_today, v_reg_target_today, v_db_update_target_today
  FROM demandcom_daily_targets
  WHERE user_id = p_user_id AND target_date = v_today
  LIMIT 1;

  SELECT COALESCE(disposition_fully_validate, 0), COALESCE(total_records_updated, 0)
  INTO v_regs_today, v_db_updates_today
  FROM demandcom_daily_performance
  WHERE user_id = p_user_id AND performance_date = v_today
  LIMIT 1;

  ------------------------------------------------
  -- SCHEDULED CALLS TODAY
  ------------------------------------------------
  SELECT COUNT(*) INTO v_scheduled_calls_today
  FROM demandcom
  WHERE assigned_to = p_user_id
    AND next_call_date >= v_today::timestamp
    AND next_call_date < (v_today + 1)::timestamp;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'contactName', COALESCE(d.name, 'Unknown'),
      'companyName', d.company_name,
      'phone', d.mobile_numb,
      'scheduledTime', d.next_call_date::text
    ) ORDER BY d.next_call_date
  ), '[]'::jsonb)
  INTO v_scheduled_calls_list
  FROM (
    SELECT id, name, company_name, mobile_numb, next_call_date
    FROM demandcom
    WHERE assigned_to = p_user_id
      AND next_call_date >= v_today::timestamp
      AND next_call_date < (v_today + 1)::timestamp
    ORDER BY next_call_date LIMIT 8
  ) d;

  ------------------------------------------------
  -- YESTERDAY'S PERFORMANCE
  ------------------------------------------------
  SELECT COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COALESCE(AVG(conversation_duration) FILTER (WHERE status = 'completed' AND conversation_duration > 0), 0)
  INTO v_calls_yesterday, v_connected_yesterday, v_avg_duration_yesterday
  FROM call_logs
  WHERE initiated_by = p_user_id
    AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = v_yesterday;

  IF v_calls_yesterday > 0 THEN
    v_connected_rate_yesterday := ROUND((v_connected_yesterday::numeric / v_calls_yesterday) * 100);
  END IF;

  SELECT COALESCE(disposition_fully_validate, 0), COALESCE(total_records_updated, 0)
  INTO v_regs_yesterday, v_db_updates_yesterday
  FROM demandcom_daily_performance
  WHERE user_id = p_user_id AND performance_date = v_yesterday;

  SELECT COALESCE(call_target, 0) INTO v_call_target_yesterday
  FROM demandcom_daily_targets
  WHERE user_id = p_user_id AND target_date = v_yesterday LIMIT 1;

  IF v_call_target_yesterday > 0 THEN
    v_target_achievement_yesterday := ROUND((v_calls_yesterday::numeric / v_call_target_yesterday) * 100);
  END IF;

  ------------------------------------------------
  -- WEEKLY BREAKDOWN
  ------------------------------------------------
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date', ds.d::date::text,
      'dayName', to_char(ds.d, 'Dy'),
      'calls', COALESCE(cl_count.cnt, 0),
      'registrations', COALESCE(dp.disposition_fully_validate, 0),
      'dbUpdates', COALESCE(dp.total_records_updated, 0),
      'attendanceStatus', ar.status
    ) ORDER BY ds.d
  ), '[]'::jsonb)
  INTO v_weekly_breakdown
  FROM generate_series(v_week_start::timestamp, v_today::timestamp, '1 day'::interval) ds(d)
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt FROM call_logs
    WHERE initiated_by = p_user_id AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = ds.d::date
  ) cl_count ON true
  LEFT JOIN demandcom_daily_performance dp
    ON dp.user_id = p_user_id AND dp.performance_date = ds.d::date
  LEFT JOIN attendance_records ar
    ON ar.user_id = p_user_id AND ar.date = ds.d::date;

  SELECT COALESCE(SUM(call_target), 0), COALESCE(SUM(registration_target), 0)
  INTO v_weekly_call_target, v_weekly_reg_target
  FROM demandcom_daily_targets
  WHERE user_id = p_user_id AND target_date >= v_week_start AND target_date <= v_today;

  v_weekly_calls_achieved := v_calls_this_week;

  SELECT COALESCE(SUM(disposition_fully_validate), 0)
  INTO v_weekly_regs_achieved
  FROM demandcom_daily_performance
  WHERE user_id = p_user_id AND performance_date >= v_week_start AND performance_date <= v_today;

  -- Tasks completed this week (unified tasks table)
  SELECT COUNT(*) INTO v_tasks_completed_week
  FROM tasks
  WHERE assigned_to = p_user_id AND status = 'completed' AND completed_at >= v_week_start::timestamp;

  ------------------------------------------------
  -- ATTENDANCE THIS MONTH
  ------------------------------------------------
  SELECT
    COUNT(*) FILTER (WHERE status = 'present'),
    COUNT(*) FILTER (WHERE status = 'half_day'),
    COUNT(*) FILTER (WHERE status = 'absent'),
    COUNT(*)
  INTO v_att_present, v_att_half_day, v_att_absent, v_att_total_days
  FROM attendance_records
  WHERE user_id = p_user_id AND date >= v_month_start AND date <= v_today;

  SELECT
    COUNT(*) FILTER (WHERE status = 'present'),
    COUNT(*) FILTER (WHERE status = 'half_day'),
    COUNT(*)
  INTO v_prev_att_present, v_prev_att_half_day, v_prev_att_total
  FROM attendance_records
  WHERE user_id = p_user_id AND date >= v_prev_month_start AND date <= v_prev_month_end;

  SELECT COUNT(*) INTO v_late_arrivals
  FROM attendance_records
  WHERE user_id = p_user_id AND date >= v_month_start AND date <= v_today
    AND sign_in_time IS NOT NULL
    AND (sign_in_time AT TIME ZONE 'Asia/Kolkata')::time > '10:15:00'::time;

  ------------------------------------------------
  -- REGULARIZATIONS
  ------------------------------------------------
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'approved'),
    COUNT(*) FILTER (WHERE status = 'rejected')
  INTO v_reg_pending, v_reg_approved, v_reg_rejected
  FROM attendance_regularizations
  WHERE user_id = p_user_id AND attendance_date >= v_month_start;

  ------------------------------------------------
  -- LEAVES
  ------------------------------------------------
  SELECT COALESCE(SUM(total_days), 0) INTO v_leaves_taken_month
  FROM leave_applications
  WHERE user_id = p_user_id AND status = 'approved'
    AND start_date >= v_month_start AND start_date <= v_month_end;

  SELECT COUNT(*) INTO v_upcoming_leaves
  FROM leave_applications
  WHERE user_id = p_user_id AND status = 'approved' AND start_date > v_today;

  SELECT COALESCE(casual_leave_balance, 0), COALESCE(earned_leave_balance, 0)
  INTO v_leave_cl, v_leave_el
  FROM leave_balances
  WHERE user_id = p_user_id AND year = v_year LIMIT 1;

  ------------------------------------------------
  -- MONTHLY TARGETS
  ------------------------------------------------
  SELECT COALESCE(SUM(call_target), 0), COALESCE(SUM(registration_target), 0)
  INTO v_monthly_call_target, v_monthly_reg_target
  FROM demandcom_daily_targets
  WHERE user_id = p_user_id AND target_date >= v_month_start AND target_date <= v_month_end;

  v_monthly_calls_achieved := v_calls_this_month;

  SELECT COALESCE(SUM(disposition_fully_validate), 0)
  INTO v_monthly_regs_achieved
  FROM demandcom_daily_performance
  WHERE user_id = p_user_id AND performance_date >= v_month_start AND performance_date <= v_today;

  ------------------------------------------------
  -- TASKS THIS MONTH (unified tasks table)
  ------------------------------------------------
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status IN ('pending','in_progress') AND due_date < v_today::timestamp)
  INTO v_tasks_assigned, v_tasks_completed, v_tasks_overdue
  FROM tasks
  WHERE assigned_to = p_user_id AND created_at >= v_month_start::timestamp;

  ------------------------------------------------
  -- PROJECTS
  ------------------------------------------------
  IF v_is_admin THEN
    SELECT
      COUNT(*) FILTER (WHERE status IN ('closed','closed_won')),
      COUNT(*) FILTER (WHERE status NOT IN ('closed','closed_won','closed_lost','lost')),
      COUNT(*)
    INTO v_projects_completed, v_projects_in_progress, v_total_projects
    FROM projects;
  ELSE
    SELECT
      COUNT(*) FILTER (WHERE p.status IN ('closed','closed_won')),
      COUNT(*) FILTER (WHERE p.status NOT IN ('closed','closed_won','closed_lost','lost')),
      COUNT(*)
    INTO v_projects_completed, v_projects_in_progress, v_total_projects
    FROM projects p
    LEFT JOIN project_team_members ptm ON ptm.project_id = p.id AND ptm.user_id = p_user_id
    WHERE ptm.user_id IS NOT NULL OR p.created_by = p_user_id;
  END IF;

  ------------------------------------------------
  -- ASSIGNED DATA STATUS
  ------------------------------------------------
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE last_call_date IS NULL),
    COUNT(*) FILTER (WHERE last_call_date IS NOT NULL),
    COUNT(*) FILTER (WHERE latest_disposition ILIKE ANY(ARRAY['%interested%','%hot lead%','%callback%','%meeting scheduled%']))
  INTO v_assigned_records, v_untouched_records, v_called_records, v_positive_dispositions
  FROM demandcom WHERE assigned_to = p_user_id;

  ------------------------------------------------
  -- DAILY CALLS CHART (7 days)
  ------------------------------------------------
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('date', ds.d::date::text, 'calls', COALESCE(c.cnt, 0))
    ORDER BY ds.d
  ), '[]'::jsonb)
  INTO v_daily_calls_data
  FROM generate_series(v_today - 6, v_today, '1 day'::interval) ds(d)
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt FROM call_logs
    WHERE initiated_by = p_user_id AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = ds.d::date
  ) c ON true;

  ------------------------------------------------
  -- LEADERBOARD (top 5)
  ------------------------------------------------
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
          AND changed_at >= v_month_start::timestamp
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

  ------------------------------------------------
  -- CURRENT USER'S LEADERBOARD RANK
  ------------------------------------------------
  BEGIN
    WITH all_ranked AS (
      SELECT sub.user_id,
        ROW_NUMBER() OVER (ORDER BY sub.registrations DESC, sub.calls DESC) AS rank
      FROM (
        SELECT
          COALESCE(c.changed_by, r.assigned_to) AS user_id,
          COALESCE(c.call_count, 0) AS calls,
          COALESCE(r.reg_count, 0) AS registrations
        FROM (
          SELECT changed_by, COUNT(*) AS call_count
          FROM demandcom_field_changes
          WHERE field_name = 'disposition'
            AND changed_at >= v_month_start::timestamp
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
      ) sub
    )
    SELECT COALESCE(rank, 0) INTO v_leaderboard_rank
    FROM all_ranked WHERE user_id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_leaderboard_rank := 0;
  END;

  ------------------------------------------------
  -- PENDING TASKS (top 8, unified tasks table)
  ------------------------------------------------
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'taskName', t.task_name,
      'priority', COALESCE(t.priority, 'medium'),
      'status', t.status,
      'dueDate', t.due_date::text,
      'projectName', t.project_name,
      'taskType', CASE WHEN t.project_id IS NOT NULL THEN 'project' ELSE 'general' END,
      'isSubtask', (t.parent_task_id IS NOT NULL)
    ) ORDER BY t.due_date NULLS LAST
  ), '[]'::jsonb)
  INTO v_pending_tasks
  FROM (
    SELECT tk.id, tk.task_name, tk.priority, tk.status, tk.due_date, tk.project_id, tk.parent_task_id,
      pr.project_name
    FROM tasks tk
    LEFT JOIN projects pr ON pr.id = tk.project_id
    WHERE tk.assigned_to = p_user_id AND tk.status NOT IN ('completed','cancelled')
    ORDER BY tk.due_date NULLS LAST
    LIMIT 8
  ) t;

  ------------------------------------------------
  -- BUILD RESULT
  ------------------------------------------------
  RETURN jsonb_build_object(
    'userName', COALESCE(v_user_name, 'User'),
    'isDemandCom', v_is_demandcom,
    'isAdmin', v_is_admin,
    'isManager', v_is_manager,
    'signInTime', v_sign_in_time::text,
    'signOutTime', v_sign_out_time::text,
    'isLate', v_is_late,
    'hoursWorkedToday', v_total_hours,
    'callsToday', v_calls_today,
    'callTargetToday', v_call_target_today,
    'registrationsToday', v_regs_today,
    'regTargetToday', v_reg_target_today,
    'dbUpdatesToday', v_db_updates_today,
    'dbUpdateTargetToday', v_db_update_target_today,
    'scheduledCallsToday', v_scheduled_calls_today,
    'scheduledCallsList', v_scheduled_calls_list,
    'callsYesterday', v_calls_yesterday,
    'registrationsYesterday', v_regs_yesterday,
    'dbUpdatesYesterday', v_db_updates_yesterday,
    'targetAchievementYesterday', v_target_achievement_yesterday,
    'connectedCallRateYesterday', v_connected_rate_yesterday,
    'avgCallDurationYesterday', v_avg_duration_yesterday
  ) || jsonb_build_object(
    'weeklyBreakdown', v_weekly_breakdown,
    'weeklyCallTarget', v_weekly_call_target,
    'weeklyCallsAchieved', v_weekly_calls_achieved,
    'weeklyRegTarget', v_weekly_reg_target,
    'weeklyRegsAchieved', v_weekly_regs_achieved,
    'tasksCompletedThisWeek', v_tasks_completed_week,
    'attendancePresent', v_att_present,
    'attendanceHalfDay', v_att_half_day,
    'attendanceAbsent', v_att_absent,
    'attendanceTotalDays', v_att_total_days,
    'lateArrivals', v_late_arrivals,
    'prevAttendanceRate', CASE WHEN v_prev_att_total > 0
      THEN ROUND(((v_prev_att_present + v_prev_att_half_day * 0.5)::numeric / v_prev_att_total) * 100)
      ELSE 0 END,
    'regularizationPending', v_reg_pending,
    'regularizationApproved', v_reg_approved,
    'regularizationRejected', v_reg_rejected,
    'leavesTakenThisMonth', v_leaves_taken_month,
    'upcomingApprovedLeaves', v_upcoming_leaves,
    'leaveBalanceCL', v_leave_cl,
    'leaveBalanceEL', v_leave_el,
    'monthlyCallTarget', v_monthly_call_target,
    'monthlyCallsAchieved', v_monthly_calls_achieved,
    'monthlyRegTarget', v_monthly_reg_target,
    'monthlyRegsAchieved', v_monthly_regs_achieved
  ) || jsonb_build_object(
    'leaderboardRank', v_leaderboard_rank,
    'leaderboardRankChange', v_leaderboard_rank_change,
    'tasksAssigned', v_tasks_assigned,
    'tasksCompleted', v_tasks_completed,
    'tasksOverdue', v_tasks_overdue,
    'projectsCompleted', v_projects_completed,
    'projectsInProgress', v_projects_in_progress,
    'totalProjects', v_total_projects,
    'leaderboard', v_leaderboard,
    'pendingTasks', v_pending_tasks,
    'callsThisWeek', v_calls_this_week,
    'callsThisMonth', v_calls_this_month,
    'assignedRecords', v_assigned_records,
    'untouchedRecords', v_untouched_records,
    'calledRecords', v_called_records,
    'positiveDispositions', v_positive_dispositions,
    'dailyCallsData', v_daily_calls_data
  );
END;
$function$;
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
