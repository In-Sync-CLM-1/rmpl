import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay } from "date-fns";

export interface AgentCallReport {
  userId: string;
  name: string;
  totalCalls: number;
  connectedCalls: number;
  avgDuration: number; // in seconds
  target: number;
  registrations: number;
  targetAchievement: number; // percentage
  conversionRate: number; // percentage
  dbUpdates: number; // count of PV/FV dispositions
}

interface UseAgentCallingReportParams {
  projectFilter?: string;
  startDate?: Date;
  endDate?: Date;
  teamMemberIds?: string[];
}

export function useAgentCallingReport({ projectFilter, startDate, endDate, teamMemberIds }: UseAgentCallingReportParams = {}) {
  return useQuery({
    queryKey: ['agent-calling-report', projectFilter, startDate?.toISOString(), endDate?.toISOString(), teamMemberIds],
    queryFn: async (): Promise<AgentCallReport[]> => {
      const normalizedStartDate = startDate ? startOfDay(startDate) : startOfDay(new Date());
      const normalizedEndDate = endDate ? endOfDay(endDate) : endOfDay(new Date());

      const { data, error } = await supabase.rpc('get_agent_calling_report', {
        p_start_date: normalizedStartDate.toISOString(),
        p_end_date: normalizedEndDate.toISOString(),
        p_project_filter: projectFilter || null,
        p_team_member_ids: teamMemberIds && teamMemberIds.length > 0 ? teamMemberIds : null,
      });

      if (error) throw new Error(`Agent report RPC failed: ${error.message}`);

      return ((data as any[]) || []).map((r: any) => ({
        userId: r.userId,
        name: r.name || 'Unknown',
        totalCalls: r.totalCalls ?? 0,
        connectedCalls: r.connectedCalls ?? 0,
        avgDuration: r.avgDuration ?? 0,
        target: r.target ?? 0,
        registrations: r.registrations ?? 0,
        targetAchievement: r.targetAchievement ?? 0,
        conversionRate: r.conversionRate ?? 0,
        dbUpdates: r.dbUpdates ?? 0,
      }));
    },
  });
}
