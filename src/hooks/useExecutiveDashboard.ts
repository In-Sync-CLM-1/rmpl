import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, startOfDay, endOfDay } from "date-fns";

export interface ExecutiveMetrics {
  healthScore: number;
  revenuePipeline: number;
  activeTeamMembers: number;
  pendingApprovals: number;
  taskMetrics: {
    completedThisWeek: number;
    completedLastWeek: number;
    overdue: number;
    completionRate: number;
    byPriority: {
      urgent: number;
      high: number;
      medium: number;
      low: number;
    };
  };
  callMetrics: {
    totalToday: number;
    totalThisWeek: number;
    totalLastWeek: number;
    byUser: Array<{ user_id: string; full_name: string; count: number }>;
    avgDuration: number;
    dispositionBreakdown: Array<{ disposition: string; count: number }>;
  };
  campaignMetrics: {
    launchedThisWeek: number;
    launchedLastWeek: number;
    avgOpenRate: number;
    avgClickRate: number;
    avgDeliveryRate: number;
    topCampaign: { name: string; openRate: number } | null;
  };
  topPriorities: Array<{
    id: string;
    type: "task" | "approval" | "follow-up" | "project";
    title: string;
    description: string;
    priority: "urgent" | "high" | "medium";
    score: number;
    metadata: any;
  }>;
  pendingItems: {
    tasks: { overdue: number; dueToday: number; dueThisWeek: number };
    approvals: { leave: number; tasks: number };
    projects: { atRisk: number; blocked: number };
    followUps: { calls: number; campaigns: number };
  };
  activityTrend: Array<{
    date: string;
    tasks: number;
    calls: number;
    emails: number;
  }>;
}

export function useExecutiveDashboard() {
  return useQuery({
    queryKey: ["executive-dashboard"],
    queryFn: async (): Promise<ExecutiveMetrics> => {
      const today = new Date();
      const weekStart = startOfDay(subDays(today, 7));
      const lastWeekStart = startOfDay(subDays(today, 14));

      // Fetch all data in parallel
      const [
        tasksData,
        callsData,
        campaignsData,
        attendanceData,
        projectsData,
        leaveApplicationsData,
      ] = await Promise.all([
        // Tasks
        supabase.from("project_tasks").select("*"),
        // Calls
        supabase.from("call_logs").select("*, profiles!call_logs_initiated_by_fkey(full_name)"),
        // Campaigns
        supabase.from("campaigns").select("*"),
        // Attendance
        supabase.from("attendance_records").select("*").gte("date", weekStart.toISOString().split('T')[0]),
        // Projects
        supabase.from("projects").select("*"),
        // Leave Applications
        supabase.from("leave_applications").select("*").eq("status", "pending"),
      ]);

      // Process Tasks
      const tasks = tasksData.data || [];
      const completedThisWeek = tasks.filter(
        (t) => t.status === "completed" && new Date(t.completed_at || "") >= weekStart
      ).length;
      const completedLastWeek = tasks.filter(
        (t) =>
          t.status === "completed" &&
          new Date(t.completed_at || "") >= lastWeekStart &&
          new Date(t.completed_at || "") < weekStart
      ).length;
      const overdueTasks = tasks.filter(
        (t) => t.status !== "completed" && new Date(t.due_date) < today
      ).length;
      const totalTasks = tasks.length;
      const completionRate = totalTasks > 0 ? (tasks.filter((t) => t.status === "completed").length / totalTasks) * 100 : 0;

      const tasksByPriority = {
        urgent: tasks.filter((t) => t.priority === "urgent" && t.status !== "completed").length,
        high: tasks.filter((t) => t.priority === "high" && t.status !== "completed").length,
        medium: tasks.filter((t) => t.priority === "medium" && t.status !== "completed").length,
        low: tasks.filter((t) => t.priority === "low" && t.status !== "completed").length,
      };

      // Process Calls
      const calls = callsData.data || [];
      const callsToday = calls.filter((c) => new Date(c.created_at) >= startOfDay(today)).length;
      const callsThisWeek = calls.filter((c) => new Date(c.created_at) >= weekStart).length;
      const callsLastWeek = calls.filter(
        (c) => new Date(c.created_at) >= lastWeekStart && new Date(c.created_at) < weekStart
      ).length;

      const callsByUser = Object.values(
        calls.reduce((acc: any, call: any) => {
          const userId = call.initiated_by;
          if (!acc[userId]) {
            acc[userId] = {
              user_id: userId,
              full_name: call.profiles?.full_name || "Unknown",
              count: 0,
            };
          }
          acc[userId].count++;
          return acc;
        }, {})
      ).sort((a: any, b: any) => b.count - a.count).slice(0, 10);

      const avgDuration = calls.length > 0
        ? calls.reduce((sum, c) => sum + (c.conversation_duration || 0), 0) / calls.length
        : 0;

      const dispositions = calls.reduce((acc: any, call) => {
        const disp = call.disposition || "Unknown";
        acc[disp] = (acc[disp] || 0) + 1;
        return acc;
      }, {});

      const dispositionBreakdown = Object.entries(dispositions).map(([disposition, count]) => ({
        disposition,
        count: count as number,
      }));

      // Process Campaigns
      const campaigns = campaignsData.data || [];
      const campaignsThisWeek = campaigns.filter((c) => new Date(c.created_at) >= weekStart).length;
      const campaignsLastWeek = campaigns.filter(
        (c) => new Date(c.created_at) >= lastWeekStart && new Date(c.created_at) < weekStart
      ).length;

      const sentCampaigns = campaigns.filter((c) => c.sent_count > 0);
      const avgOpenRate = sentCampaigns.length > 0
        ? sentCampaigns.reduce((sum, c) => sum + (c.opened_count / c.sent_count) * 100, 0) / sentCampaigns.length
        : 0;
      const avgClickRate = sentCampaigns.length > 0
        ? sentCampaigns.reduce((sum, c) => sum + (c.clicked_count / c.sent_count) * 100, 0) / sentCampaigns.length
        : 0;
      const avgDeliveryRate = sentCampaigns.length > 0
        ? sentCampaigns.reduce((sum, c) => sum + (c.delivered_count / c.sent_count) * 100, 0) / sentCampaigns.length
        : 0;

      const topCampaign = sentCampaigns.length > 0
        ? sentCampaigns.reduce((top, c) => {
            const openRate = (c.opened_count / c.sent_count) * 100;
            return !top || openRate > top.openRate ? { name: c.name, openRate } : top;
          }, null as any)
        : null;

      // Process Attendance
      const activeMembers = new Set(
        (attendanceData.data || []).filter((a) => a.status === "present").map((a) => a.user_id)
      ).size;

      // Process Projects
      const projects = projectsData.data || [];
      const revenuePipeline = 0; // Would need quotation data

      // Calculate Health Score
      const taskScore = completionRate;
      const callScore = callsThisWeek > callsLastWeek ? 80 : 60;
      const campaignScore = avgOpenRate;
      const attendanceScore = activeMembers > 0 ? 80 : 50;
      const healthScore = Math.round(
        taskScore * 0.3 + callScore * 0.25 + campaignScore * 0.25 + attendanceScore * 0.2
      );

      // Top Priorities
      const topPriorities = [
        ...tasks
          .filter((t) => t.status !== "completed")
          .map((t) => {
            const priorityScore = { urgent: 4, high: 3, medium: 2, low: 1 }[t.priority] || 1;
            const daysOverdue = Math.max(0, Math.ceil((today.getTime() - new Date(t.due_date).getTime()) / (1000 * 60 * 60 * 24)));
            const score = priorityScore * 3 + daysOverdue * 2;
            return {
              id: t.id,
              type: "task" as const,
              title: t.task_name,
              description: t.description || "",
              priority: t.priority as "urgent" | "high" | "medium",
              score,
              metadata: t,
            };
          }),
        ...(leaveApplicationsData.data || []).map((l) => ({
          id: l.id,
          type: "approval" as const,
          title: `Leave Approval: ${l.leave_type}`,
          description: `${l.total_days} days starting ${l.start_date}`,
          priority: "high" as const,
          score: 10,
          metadata: l,
        })),
      ]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      // Pending Items
      const tasksDueToday = tasks.filter(
        (t) =>
          t.status !== "completed" &&
          new Date(t.due_date).toDateString() === today.toDateString()
      ).length;
      const tasksDueThisWeek = tasks.filter(
        (t) =>
          t.status !== "completed" &&
          new Date(t.due_date) >= today &&
          new Date(t.due_date) <= endOfDay(subDays(today, -7))
      ).length;

      // Activity Trend (last 7 days)
      const activityTrend = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(today, 6 - i);
        const dateStr = date.toISOString().split('T')[0];
        return {
          date: dateStr,
          tasks: tasks.filter((t) => t.completed_at?.startsWith(dateStr)).length,
          calls: calls.filter((c) => c.created_at.startsWith(dateStr)).length,
          emails: campaigns.filter((c) => c.sent_at?.startsWith(dateStr)).length,
        };
      });

      return {
        healthScore,
        revenuePipeline,
        activeTeamMembers: activeMembers,
        pendingApprovals: (leaveApplicationsData.data || []).length,
        taskMetrics: {
          completedThisWeek,
          completedLastWeek,
          overdue: overdueTasks,
          completionRate,
          byPriority: tasksByPriority,
        },
        callMetrics: {
          totalToday: callsToday,
          totalThisWeek: callsThisWeek,
          totalLastWeek: callsLastWeek,
          byUser: callsByUser as any,
          avgDuration,
          dispositionBreakdown,
        },
        campaignMetrics: {
          launchedThisWeek: campaignsThisWeek,
          launchedLastWeek: campaignsLastWeek,
          avgOpenRate,
          avgClickRate,
          avgDeliveryRate,
          topCampaign,
        },
        topPriorities,
        pendingItems: {
          tasks: {
            overdue: overdueTasks,
            dueToday: tasksDueToday,
            dueThisWeek: tasksDueThisWeek,
          },
          approvals: {
            leave: (leaveApplicationsData.data || []).length,
            tasks: tasks.filter((t) => t.status === "pending").length,
          },
          projects: {
            atRisk: projects.filter((p) => p.status === "at_risk").length,
            blocked: projects.filter((p) => p.status === "blocked").length,
          },
          followUps: {
            calls: 0,
            campaigns: 0,
          },
        },
        activityTrend,
      };
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });
}
