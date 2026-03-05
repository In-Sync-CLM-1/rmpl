import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";

export interface PersonalDashboardData {
  // Projects
  projectsCompleted: number;
  projectsInProgress: number;
  totalProjectsAssigned: number;
  
  // Tasks
  tasksAssigned: number;
  tasksPending: number;
  tasksOverdue: number;
  tasksCompletedThisMonth: number;
  
  // Attendance
  attendanceThisMonth: {
    present: number;
    halfDay: number;
    absent: number;
    totalDays: number;
  };
  todayAttendance: {
    signedIn: boolean;
    signInTime: string | null;
    signOutTime: string | null;
  };
  
  // Leave
  leaveBalance: {
    casualLeave: number;
    earnedLeave: number;
    totalUsed: number;
  };
  leaveApplied: number;
  
  // Calls
  callsToday: number;
  callsThisWeek: number;
  callsThisMonth: number;
  dailyCallsData: Array<{ date: string; calls: number }>;
  scheduledCallsToday: number;
  
  // Targets
  dailyTarget: {
    callTarget: number;
    callsAchieved: number;
    registrationTarget: number;
    registrationsAchieved: number;
  };
  monthlyTarget: {
    callTarget: number;
    callsAchieved: number;
    registrationTarget: number;
    registrationsAchieved: number;
  };
  
  // Database/Data Status
  assignedRecords: number;
  untouchedRecords: number;
  calledRecords: number;
  positiveDispositions: number;
  
  // Leaderboard
  leaderboard: Array<{
    userId: string;
    userName: string;
    calls: number;
    registrations: number;
    rank: number;
  }>;
}

export function usePersonalDashboard() {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  return useQuery({
    queryKey: ["personal-dashboard", todayStr],
    queryFn: async (): Promise<PersonalDashboardData> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const userId = user.id;

      // Check if user is admin for showing all projects
      const { data: userRolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      
      const isAdmin = (userRolesData || []).some(r => 
        ['platform_admin', 'super_admin', 'admin', 'admin_administration', 'admin_tech'].includes(r.role)
      );

      // Fetch all data in parallel
      const [
        projectsTeamData,
        projectsCreatedData,
        allProjectsData,
        tasksData,
        attendanceData,
        todayAttendanceData,
        leaveBalanceData,
        leaveApplicationsData,
        callsData,
        dailyTargetData,
        monthlyTargetData,
        assignedDataStatus,
        scheduledCallsData,
        leaderboardCallsData,
        leaderboardRegistrationsData,
        leaderboardProfilesData,
      ] = await Promise.all([
        // Projects assigned to user (as team member)
        supabase
          .from("project_team_members")
          .select(`
            project:projects!project_team_members_project_id_fkey(id, status)
          `)
          .eq("user_id", userId),
        // Projects created by user
        supabase
          .from("projects")
          .select("id, status")
          .eq("created_by", userId),
        // All projects (for admins)
        isAdmin 
          ? supabase.from("projects").select("id, status")
          : Promise.resolve({ data: [] }),
          
        // Tasks assigned to user
        supabase
          .from("general_tasks")
          .select("id, status, due_date, completed_at")
          .eq("assigned_to", userId),
          
        // Attendance this month
        supabase
          .from("attendance_records")
          .select("date, status")
          .eq("user_id", userId)
          .gte("date", format(monthStart, 'yyyy-MM-dd'))
          .lte("date", format(monthEnd, 'yyyy-MM-dd')),
          
        // Today's attendance
        supabase
          .from("attendance_records")
          .select("sign_in_time, sign_out_time, status")
          .eq("user_id", userId)
          .eq("date", todayStr)
          .maybeSingle(),
          
        // Leave balance
        supabase
          .from("leave_balances")
          .select("*")
          .eq("user_id", userId)
          .eq("year", today.getFullYear())
          .maybeSingle(),
          
        // Leave applications count for current user this year
        supabase
          .from("leave_applications")
          .select("id", { count: 'exact', head: true })
          .eq("user_id", userId),
          
        // Calls data
        supabase
          .from("call_logs")
          .select("created_at, status, disposition")
          .eq("initiated_by", userId)
          .gte("created_at", format(monthStart, 'yyyy-MM-dd')),
          
        // Daily target
        supabase
          .from("demandcom_daily_targets")
          .select("call_target, registration_target")
          .eq("user_id", userId)
          .eq("target_date", todayStr)
          .maybeSingle(),
          
        // Monthly targets (sum of all daily targets this month)
        supabase
          .from("demandcom_daily_targets")
          .select("call_target, registration_target")
          .eq("user_id", userId)
          .gte("target_date", format(monthStart, 'yyyy-MM-dd'))
          .lte("target_date", format(monthEnd, 'yyyy-MM-dd')),
          
        // Assigned data status
        supabase
          .from("demandcom")
          .select("id, latest_disposition, last_call_date")
          .eq("assigned_to", userId),
          
        // Scheduled calls today (next_call_date)
        supabase
          .from("demandcom")
          .select("id", { count: 'exact', head: true })
          .eq("assigned_to", userId)
          .gte("next_call_date", `${todayStr}T00:00:00`)
          .lte("next_call_date", `${todayStr}T23:59:59`),
          
        // Leaderboard - disposition changes (calls) this month by all users
        supabase
          .from("demandcom_field_changes")
          .select("changed_by")
          .eq("field_name", "disposition")
          .gte("changed_at", format(monthStart, 'yyyy-MM-dd'))
          .not("changed_by", "is", null),
          
        // Leaderboard - registrations this month from demandcom
        supabase
          .from("demandcom")
          .select("assigned_to, updated_at")
          .eq("latest_subdisposition", "Registered")
          .gte("updated_at", format(monthStart, 'yyyy-MM-dd'))
          .not("assigned_to", "is", null),
          
        // Get all profiles for leaderboard
        supabase
          .from("profiles")
          .select("id, full_name"),
      ]);

      // Process projects - for admins show all projects, for others show their assigned/created projects
      let projects: any[];
      
      if (isAdmin) {
        // Admin users see all system projects
        projects = allProjectsData.data || [];
      } else {
        // Regular users see projects they're team members of or created
        const teamProjects = (projectsTeamData.data || []).map((p: any) => p.project).filter(Boolean);
        const createdProjects = projectsCreatedData.data || [];
        
        // Deduplicate by project id
        const projectsMap = new Map<string, any>();
        [...teamProjects, ...createdProjects].forEach((p: any) => {
          if (p?.id) projectsMap.set(p.id, p);
        });
        projects = Array.from(projectsMap.values());
      }
      
      // Count completed and in-progress projects (using correct status values)
      const projectsCompleted = projects.filter((p: any) => 
        p?.status === 'closed' || p?.status === 'closed_won'
      ).length;
      const projectsInProgress = projects.filter((p: any) => 
        p?.status && !['closed', 'closed_won', 'closed_lost', 'lost'].includes(p.status)
      ).length;

      // Process tasks
      const tasks = tasksData.data || [];
      const tasksPending = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
      const tasksOverdue = tasks.filter(t => 
        (t.status === 'pending' || t.status === 'in_progress') && 
        new Date(t.due_date) < today
      ).length;
      const tasksCompletedThisMonth = tasks.filter(t => 
        t.status === 'completed' && 
        t.completed_at && 
        new Date(t.completed_at) >= monthStart
      ).length;

      // Process attendance
      const attendance = attendanceData.data || [];
      const attendanceThisMonth = {
        present: attendance.filter(a => a.status === 'present').length,
        halfDay: attendance.filter(a => a.status === 'half_day').length,
        absent: attendance.filter(a => a.status === 'absent').length,
        totalDays: attendance.length,
      };

      // Process calls
      const calls = callsData.data || [];
      const callsThisMonth = calls.length;
      const callsThisWeek = calls.filter(c => 
        new Date(c.created_at) >= weekStart && new Date(c.created_at) <= weekEnd
      ).length;
      const callsToday = calls.filter(c => 
        format(new Date(c.created_at), 'yyyy-MM-dd') === todayStr
      ).length;

      // Build daily calls chart data (last 7 days)
      const dailyCallsData: Array<{ date: string; calls: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const count = calls.filter(c => format(new Date(c.created_at), 'yyyy-MM-dd') === dateStr).length;
        dailyCallsData.push({ date: dateStr, calls: count });
      }

      // Process daily target
      const dailyTarget = {
        callTarget: dailyTargetData.data?.call_target || 0,
        callsAchieved: callsToday,
        registrationTarget: dailyTargetData.data?.registration_target || 0,
        registrationsAchieved: calls.filter(c => 
          format(new Date(c.created_at), 'yyyy-MM-dd') === todayStr &&
          c.disposition?.toLowerCase().includes('interested')
        ).length,
      };

      // Process monthly target
      const monthlyTargets = monthlyTargetData.data || [];
      const monthlyTarget = {
        callTarget: monthlyTargets.reduce((sum, t) => sum + (t.call_target || 0), 0),
        callsAchieved: callsThisMonth,
        registrationTarget: monthlyTargets.reduce((sum, t) => sum + (t.registration_target || 0), 0),
        registrationsAchieved: calls.filter(c => 
          c.disposition?.toLowerCase().includes('interested')
        ).length,
      };

      // Process assigned data status
      const assignedData = assignedDataStatus.data || [];
      const assignedRecords = assignedData.length;
      const calledRecords = assignedData.filter(d => d.last_call_date).length;
      const untouchedRecords = assignedRecords - calledRecords;
      const positiveDispositions = assignedData.filter(d => 
        d.latest_disposition && 
        ['interested', 'hot lead', 'callback', 'meeting scheduled'].some(pos => 
          d.latest_disposition?.toLowerCase().includes(pos)
        )
      ).length;

      // Process leave balance
      const leaveBalance = {
        casualLeave: leaveBalanceData.data?.casual_leave_balance || 0,
        earnedLeave: leaveBalanceData.data?.earned_leave_balance || 0,
        totalUsed: (
          (12 - (leaveBalanceData.data?.casual_leave_balance || 12)) +
          (15 - (leaveBalanceData.data?.earned_leave_balance || 15))
        ),
      };

      // Process leaderboard
      const leaderboardCalls = leaderboardCallsData.data || [];
      const leaderboardRegistrations = leaderboardRegistrationsData.data || [];
      const profilesMap = new Map<string, string>();
      (leaderboardProfilesData.data || []).forEach((p: any) => {
        profilesMap.set(p.id, p.full_name || 'Unknown');
      });
      
      // Count calls (disposition changes) per user
      const userCallCounts = new Map<string, number>();
      leaderboardCalls.forEach((change: any) => {
        if (!change.changed_by) return;
        userCallCounts.set(change.changed_by, (userCallCounts.get(change.changed_by) || 0) + 1);
      });
      
      // Count registrations per user from demandcom
      const userRegistrationCounts = new Map<string, number>();
      leaderboardRegistrations.forEach((record: any) => {
        if (!record.assigned_to) return;
        userRegistrationCounts.set(record.assigned_to, (userRegistrationCounts.get(record.assigned_to) || 0) + 1);
      });
      
      // Combine all unique users from both calls and registrations
      const allUserIds = new Set([...userCallCounts.keys(), ...userRegistrationCounts.keys()]);
      
      const leaderboard = Array.from(allUserIds)
        .map(userId => ({
          userId,
          userName: profilesMap.get(userId) || 'Unknown',
          calls: userCallCounts.get(userId) || 0,
          registrations: userRegistrationCounts.get(userId) || 0,
          rank: 0,
        }))
        .sort((a, b) => b.registrations - a.registrations)
        .slice(0, 5)
        .map((item, index) => ({ ...item, rank: index + 1 }));

      return {
        projectsCompleted,
        projectsInProgress,
        totalProjectsAssigned: projects.length,
        tasksAssigned: tasks.length,
        tasksPending,
        tasksOverdue,
        tasksCompletedThisMonth,
        attendanceThisMonth,
        todayAttendance: {
          signedIn: !!todayAttendanceData.data?.sign_in_time,
          signInTime: todayAttendanceData.data?.sign_in_time || null,
          signOutTime: todayAttendanceData.data?.sign_out_time || null,
        },
        leaveBalance,
        leaveApplied: leaveApplicationsData.count || 0,
        callsToday,
        callsThisWeek,
        callsThisMonth,
        dailyCallsData,
        scheduledCallsToday: scheduledCallsData.count || 0,
        dailyTarget,
        monthlyTarget,
        assignedRecords,
        untouchedRecords,
        calledRecords,
        positiveDispositions,
        leaderboard,
      };
    },
    staleTime: 60000, // 1 minute
  });
}