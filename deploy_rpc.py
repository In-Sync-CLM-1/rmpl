import json
import urllib.request
import urllib.error

sql = """CREATE OR REPLACE FUNCTION get_daily_targets_dashboard(
  p_user_id UUID,
  p_target_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_is_admin BOOLEAN;
  v_is_manager BOOLEAN;
  v_is_leadership BOOLEAN;
  v_is_team_leader BOOLEAN;
  v_date_start TIMESTAMPTZ;
  v_date_end TIMESTAMPTZ;
BEGIN
  v_date_start := p_target_date::timestamptz;
  v_date_end := (p_target_date + 1)::timestamptz;

  -- Check roles
  SELECT
    bool_or(role IN ('platform_admin', 'super_admin', 'admin_administration', 'admin_tech', 'admin')),
    bool_or(role = 'manager'),
    bool_or(role = 'leadership')
  INTO v_is_admin, v_is_manager, v_is_leadership
  FROM user_roles WHERE user_id = p_user_id;

  v_is_admin := COALESCE(v_is_admin, false);
  v_is_manager := COALESCE(v_is_manager, false);
  v_is_leadership := COALESCE(v_is_leadership, false);

  -- Build complete dashboard data
  WITH
  -- Get all active Demandcom-Calling team members
  team_members_cte AS (
    SELECT tm.user_id
    FROM team_members tm
    JOIN teams t ON t.id = tm.team_id
    WHERE t.name = 'Demandcom-Calling' AND tm.is_active = true
  ),
  -- Get profiles with reports_to for team members
  member_profiles AS (
    SELECT p.id, p.full_name, p.email, p.reports_to
    FROM profiles p
    WHERE p.id IN (SELECT user_id FROM team_members_cte)
  ),
  -- Discover team leaders from reports_to
  team_leaders AS (
    SELECT DISTINCT mp.reports_to AS leader_id
    FROM member_profiles mp
    WHERE mp.reports_to IS NOT NULL
  ),
  -- Leader profiles
  leader_profiles AS (
    SELECT p.id, p.full_name, p.email, p.reports_to
    FROM profiles p
    WHERE p.id IN (SELECT leader_id FROM team_leaders)
  ),
  -- Filter leaders based on user role
  filtered_leaders AS (
    SELECT leader_id
    FROM team_leaders
    WHERE v_is_admin OR v_is_leadership OR v_is_manager
       OR leader_id = p_user_id
  ),
  -- All agent IDs under filtered leaders
  all_agent_ids AS (
    SELECT mp.id AS agent_id, mp.reports_to AS leader_id
    FROM member_profiles mp
    WHERE mp.reports_to IN (SELECT leader_id FROM filtered_leaders)
  ),
  -- Attendance
  attendance_cte AS (
    SELECT user_id
    FROM attendance_records
    WHERE date = p_target_date
      AND sign_in_time IS NOT NULL
      AND user_id IN (
        SELECT agent_id FROM all_agent_ids
        UNION SELECT leader_id FROM filtered_leaders
      )
  ),
  -- Targets
  targets_cte AS (
    SELECT
      user_id,
      SUM(COALESCE(call_target, 0)) AS call_target,
      SUM(COALESCE(registration_target, 0)) AS reg_target,
      SUM(COALESCE(database_update_target, 0)) AS db_update_target
    FROM demandcom_daily_targets
    WHERE target_date = p_target_date
    GROUP BY user_id
  ),
  -- Disposition changes (calls) for agents
  disp_calls AS (
    SELECT changed_by, COUNT(*) AS call_count
    FROM demandcom_field_changes
    WHERE field_name = 'disposition'
      AND changed_by IN (SELECT agent_id FROM all_agent_ids)
      AND changed_at >= v_date_start AND changed_at < v_date_end
    GROUP BY changed_by
  ),
  -- Call logs for agents
  call_log_calls AS (
    SELECT initiated_by, COUNT(*) AS call_count
    FROM call_logs
    WHERE initiated_by IN (SELECT agent_id FROM all_agent_ids)
      AND created_at >= v_date_start AND created_at < v_date_end
    GROUP BY initiated_by
  ),
  -- Actual calls (max of disposition changes and call logs)
  actual_calls AS (
    SELECT
      COALESCE(dc.changed_by, cl.initiated_by) AS agent_id,
      GREATEST(COALESCE(dc.call_count, 0), COALESCE(cl.call_count, 0)) AS calls
    FROM disp_calls dc
    FULL OUTER JOIN call_log_calls cl ON dc.changed_by = cl.initiated_by
  ),
  -- Connected dispositions -> Registered (agent registrations)
  connected_changes AS (
    SELECT changed_by, demandcom_id
    FROM demandcom_field_changes
    WHERE field_name = 'disposition'
      AND new_value IN ('Connected', 'Connected 1', 'Connected 2', 'Connected 3', 'Connected 4')
      AND changed_by IN (SELECT agent_id FROM all_agent_ids)
      AND changed_at >= v_date_start AND changed_at < v_date_end
  ),
  agent_regs AS (
    SELECT cc.changed_by, COUNT(DISTINCT cc.demandcom_id) AS reg_count
    FROM connected_changes cc
    JOIN demandcom d ON d.id = cc.demandcom_id AND d.latest_subdisposition = 'Registered'
    GROUP BY cc.changed_by
  ),
  -- Bulk registrations
  all_connected_ids AS (
    SELECT DISTINCT demandcom_id FROM demandcom_field_changes
    WHERE field_name = 'disposition' AND new_value IN ('Connected', 'Connected 1', 'Connected 2', 'Connected 3', 'Connected 4')
  ),
  bulk_regs AS (
    SELECT d.assigned_to, COUNT(*) AS reg_count
    FROM demandcom d
    WHERE d.latest_subdisposition = 'Registered'
      AND d.assigned_to IN (SELECT agent_id FROM all_agent_ids)
      AND d.created_at >= v_date_start AND d.created_at < v_date_end
      AND d.id NOT IN (SELECT demandcom_id FROM all_connected_ids WHERE demandcom_id IS NOT NULL)
    GROUP BY d.assigned_to
  ),
  -- DB updates (PV/FV)
  db_updates AS (
    SELECT changed_by, COUNT(DISTINCT demandcom_id) AS update_count
    FROM demandcom_field_changes
    WHERE field_name = 'disposition'
      AND new_value IN ('Partially Validate', 'Fully Validate')
      AND changed_by IN (SELECT agent_id FROM all_agent_ids)
      AND changed_at >= v_date_start AND changed_at < v_date_end
    GROUP BY changed_by
  ),
  -- Build hierarchy JSON
  hierarchy AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'teamLeader', jsonb_build_object(
          'id', fl.leader_id,
          'full_name', COALESCE(lp.full_name, 'Unknown'),
          'email', COALESCE(lp.email, ''),
          'reports_to', lp.reports_to,
          'callTarget', COALESCE(lt.call_target, 0),
          'regTarget', COALESCE(lt.reg_target, 0),
          'dbUpdateTarget', COALESCE(lt.db_update_target, 0),
          'hasAttendance', EXISTS(SELECT 1 FROM attendance_cte WHERE user_id = fl.leader_id)
        ),
        'agents', (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
              'id', mp.id,
              'full_name', COALESCE(mp.full_name, 'Unknown'),
              'email', COALESCE(mp.email, ''),
              'reports_to', mp.reports_to,
              'callTarget', COALESCE(at2.call_target, 0),
              'regTarget', COALESCE(at2.reg_target, 0),
              'dbUpdateTarget', COALESCE(at2.db_update_target, 0),
              'hasAttendance', EXISTS(SELECT 1 FROM attendance_cte WHERE user_id = mp.id),
              'achievement', jsonb_build_object(
                'actualCalls', COALESCE(ac.calls, 0),
                'actualRegistrations', COALESCE(ar.reg_count, 0) + COALESCE(br.reg_count, 0),
                'actualDatabaseUpdates', COALESCE(du.update_count, 0)
              )
            ) ORDER BY mp.full_name
          ), '[]'::jsonb)
          FROM member_profiles mp
          LEFT JOIN targets_cte at2 ON at2.user_id = mp.id
          LEFT JOIN actual_calls ac ON ac.agent_id = mp.id
          LEFT JOIN agent_regs ar ON ar.changed_by = mp.id
          LEFT JOIN bulk_regs br ON br.assigned_to = mp.id
          LEFT JOIN db_updates du ON du.changed_by = mp.id
          WHERE mp.reports_to = fl.leader_id
        )
      ) ORDER BY lp.full_name
    ) AS data
    FROM filtered_leaders fl
    LEFT JOIN leader_profiles lp ON lp.id = fl.leader_id
    LEFT JOIN targets_cte lt ON lt.user_id = fl.leader_id
    WHERE EXISTS (SELECT 1 FROM member_profiles mp2 WHERE mp2.reports_to = fl.leader_id)
  )
  SELECT jsonb_build_object(
    'hierarchy', COALESCE(h.data, '[]'::jsonb),
    'teamLeaderIds', (SELECT COALESCE(jsonb_agg(leader_id), '[]'::jsonb) FROM filtered_leaders),
    'isAdmin', v_is_admin
  )
  INTO v_result
  FROM hierarchy h;

  RETURN COALESCE(v_result, jsonb_build_object('hierarchy', '[]'::jsonb, 'teamLeaderIds', '[]'::jsonb, 'isAdmin', v_is_admin));
END;
$$;"""

url = "https://api.supabase.com/v1/projects/ltlvhmwrrsromwuiybwu/database/query"
token = "sbp_68e70c187e18c25ba82fc27a13585372ef8c7ad2"

payload = json.dumps({"query": sql.strip()}).encode("utf-8")

req = urllib.request.Request(url, data=payload, method="POST")
req.add_header("Authorization", "Bearer " + token)
req.add_header("Content-Type", "application/json")
req.add_header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode("utf-8")
        print("Status: " + str(resp.status))
        print("Response: " + body)
except urllib.error.HTTPError as e:
    body = e.read().decode("utf-8")
    print("HTTP Error: " + str(e.code))
    print("Response: " + body)
except Exception as e:
    print("Error: " + str(e))
