import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface ScheduledCallItem {
  id: string;
  contactName: string;
  companyName: string | null;
  phone: string | null;
  scheduledTime: string;
}

export interface WeeklyDayBreakdown {
  date: string;
  dayName: string;
  calls: number;
  registrations: number;
  dbUpdates: number;
  attendanceStatus: string | null;
}

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  registrations: number;
  calls: number;
  rank: number;
}

export interface PendingTaskItem {
  id: string;
  taskName: string;
  priority: string;
  status: string;
  dueDate: string;
  projectName: string | null;
  taskType: "general" | "project";
  isSubtask: boolean;
}

export interface PersonalDashboardData {
  userName: string;
  isDemandCom: boolean;
  isAdmin: boolean;
  isManager: boolean;

  // Today
  signInTime: string | null;
  signOutTime: string | null;
  isLate: boolean;
  hoursWorkedToday: number;
  callsToday: number;
  callTargetToday: number;
  registrationsToday: number;
  regTargetToday: number;
  dbUpdatesToday: number;
  dbUpdateTargetToday: number;
  scheduledCallsToday: number;
  scheduledCallsList: ScheduledCallItem[];

  // Yesterday
  callsYesterday: number;
  registrationsYesterday: number;
  dbUpdatesYesterday: number;
  targetAchievementYesterday: number;
  connectedCallRateYesterday: number;
  avgCallDurationYesterday: number;

  // Week
  weeklyBreakdown: WeeklyDayBreakdown[];
  weeklyCallTarget: number;
  weeklyCallsAchieved: number;
  weeklyRegTarget: number;
  weeklyRegsAchieved: number;
  tasksCompletedThisWeek: number;

  // Month attendance
  attendancePresent: number;
  attendanceHalfDay: number;
  attendanceAbsent: number;
  attendanceTotalDays: number;
  lateArrivals: number;
  prevAttendanceRate: number;

  // Regularizations
  regularizationPending: number;
  regularizationApproved: number;
  regularizationRejected: number;

  // Leaves
  leavesTakenThisMonth: number;
  upcomingApprovedLeaves: number;
  leaveBalanceCL: number;
  leaveBalanceEL: number;

  // Monthly targets
  monthlyCallTarget: number;
  monthlyCallsAchieved: number;
  monthlyRegTarget: number;
  monthlyRegsAchieved: number;

  // Rank
  leaderboardRank: number;
  leaderboardRankChange: number;

  // Tasks
  tasksAssigned: number;
  tasksCompleted: number;
  tasksOverdue: number;

  // Projects
  projectsCompleted: number;
  projectsInProgress: number;
  totalProjects: number;

  // Leaderboard
  leaderboard: LeaderboardEntry[];

  // Pending tasks
  pendingTasks: PendingTaskItem[];

  // Extra
  callsThisWeek: number;
  callsThisMonth: number;
  assignedRecords: number;
  untouchedRecords: number;
  calledRecords: number;
  positiveDispositions: number;
  dailyCallsData: Array<{ date: string; calls: number }>;
}

export function usePersonalDashboard() {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["personal-dashboard-v2", todayStr],
    queryFn: async (): Promise<PersonalDashboardData> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc(
        "get_personal_dashboard_v2",
        { p_user_id: user.id } as any
      );

      if (error) throw new Error(`Dashboard RPC failed: ${error.message}`);

      const d = data as any;
      return {
        userName: d.userName ?? "User",
        isDemandCom: d.isDemandCom ?? false,
        isAdmin: d.isAdmin ?? false,
        isManager: d.isManager ?? false,

        signInTime: d.signInTime ?? null,
        signOutTime: d.signOutTime ?? null,
        isLate: d.isLate ?? false,
        hoursWorkedToday: d.hoursWorkedToday ?? 0,

        callsToday: d.callsToday ?? 0,
        callTargetToday: d.callTargetToday ?? 0,
        registrationsToday: d.registrationsToday ?? 0,
        regTargetToday: d.regTargetToday ?? 0,
        dbUpdatesToday: d.dbUpdatesToday ?? 0,
        dbUpdateTargetToday: d.dbUpdateTargetToday ?? 0,
        scheduledCallsToday: d.scheduledCallsToday ?? 0,
        scheduledCallsList: d.scheduledCallsList ?? [],

        callsYesterday: d.callsYesterday ?? 0,
        registrationsYesterday: d.registrationsYesterday ?? 0,
        dbUpdatesYesterday: d.dbUpdatesYesterday ?? 0,
        targetAchievementYesterday: d.targetAchievementYesterday ?? 0,
        connectedCallRateYesterday: d.connectedCallRateYesterday ?? 0,
        avgCallDurationYesterday: d.avgCallDurationYesterday ?? 0,

        weeklyBreakdown: d.weeklyBreakdown ?? [],
        weeklyCallTarget: d.weeklyCallTarget ?? 0,
        weeklyCallsAchieved: d.weeklyCallsAchieved ?? 0,
        weeklyRegTarget: d.weeklyRegTarget ?? 0,
        weeklyRegsAchieved: d.weeklyRegsAchieved ?? 0,
        tasksCompletedThisWeek: d.tasksCompletedThisWeek ?? 0,

        attendancePresent: d.attendancePresent ?? 0,
        attendanceHalfDay: d.attendanceHalfDay ?? 0,
        attendanceAbsent: d.attendanceAbsent ?? 0,
        attendanceTotalDays: d.attendanceTotalDays ?? 0,
        lateArrivals: d.lateArrivals ?? 0,
        prevAttendanceRate: d.prevAttendanceRate ?? 0,

        regularizationPending: d.regularizationPending ?? 0,
        regularizationApproved: d.regularizationApproved ?? 0,
        regularizationRejected: d.regularizationRejected ?? 0,

        leavesTakenThisMonth: d.leavesTakenThisMonth ?? 0,
        upcomingApprovedLeaves: d.upcomingApprovedLeaves ?? 0,
        leaveBalanceCL: d.leaveBalanceCL ?? 0,
        leaveBalanceEL: d.leaveBalanceEL ?? 0,

        monthlyCallTarget: d.monthlyCallTarget ?? 0,
        monthlyCallsAchieved: d.monthlyCallsAchieved ?? 0,
        monthlyRegTarget: d.monthlyRegTarget ?? 0,
        monthlyRegsAchieved: d.monthlyRegsAchieved ?? 0,

        leaderboardRank: d.leaderboardRank ?? 0,
        leaderboardRankChange: d.leaderboardRankChange ?? 0,

        tasksAssigned: d.tasksAssigned ?? 0,
        tasksCompleted: d.tasksCompleted ?? 0,
        tasksOverdue: d.tasksOverdue ?? 0,

        projectsCompleted: d.projectsCompleted ?? 0,
        projectsInProgress: d.projectsInProgress ?? 0,
        totalProjects: d.totalProjects ?? 0,

        leaderboard: d.leaderboard ?? [],
        pendingTasks: d.pendingTasks ?? [],

        callsThisWeek: d.callsThisWeek ?? 0,
        callsThisMonth: d.callsThisMonth ?? 0,
        assignedRecords: d.assignedRecords ?? 0,
        untouchedRecords: d.untouchedRecords ?? 0,
        calledRecords: d.calledRecords ?? 0,
        positiveDispositions: d.positiveDispositions ?? 0,
        dailyCallsData: d.dailyCallsData ?? [],
      };
    },
    staleTime: 60000,
  });
}
