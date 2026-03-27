import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

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

  return useQuery({
    queryKey: ["personal-dashboard", todayStr],
    queryFn: async (): Promise<PersonalDashboardData> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc('get_personal_dashboard', {
        p_user_id: user.id,
      });

      if (error) throw new Error(`Dashboard RPC failed: ${error.message}`);

      const d = data as any;
      return {
        projectsCompleted: d.projectsCompleted ?? 0,
        projectsInProgress: d.projectsInProgress ?? 0,
        totalProjectsAssigned: d.totalProjectsAssigned ?? 0,
        tasksAssigned: d.tasksAssigned ?? 0,
        tasksPending: d.tasksPending ?? 0,
        tasksOverdue: d.tasksOverdue ?? 0,
        tasksCompletedThisMonth: d.tasksCompletedThisMonth ?? 0,
        attendanceThisMonth: d.attendanceThisMonth ?? { present: 0, halfDay: 0, absent: 0, totalDays: 0 },
        todayAttendance: d.todayAttendance ?? { signedIn: false, signInTime: null, signOutTime: null },
        leaveBalance: d.leaveBalance ?? { casualLeave: 0, earnedLeave: 0, totalUsed: 0 },
        leaveApplied: d.leaveApplied ?? 0,
        callsToday: d.callsToday ?? 0,
        callsThisWeek: d.callsThisWeek ?? 0,
        callsThisMonth: d.callsThisMonth ?? 0,
        dailyCallsData: d.dailyCallsData ?? [],
        scheduledCallsToday: d.scheduledCallsToday ?? 0,
        dailyTarget: d.dailyTarget ?? { callTarget: 0, callsAchieved: 0, registrationTarget: 0, registrationsAchieved: 0 },
        monthlyTarget: d.monthlyTarget ?? { callTarget: 0, callsAchieved: 0, registrationTarget: 0, registrationsAchieved: 0 },
        assignedRecords: d.assignedRecords ?? 0,
        untouchedRecords: d.untouchedRecords ?? 0,
        calledRecords: d.calledRecords ?? 0,
        positiveDispositions: d.positiveDispositions ?? 0,
        leaderboard: d.leaderboard ?? [],
      };
    },
    staleTime: 60000,
  });
}
