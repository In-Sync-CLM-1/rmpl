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
      const normalizedStartDate = startDate ? startOfDay(startDate) : undefined;
      const normalizedEndDate = endDate ? endOfDay(endDate) : undefined;
      const nonConnectedDispositions = ['NR ( No Response )'];
      const targetDateStart = startDate ? startDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      const targetDateEnd = endDate ? endDate.toISOString().split('T')[0] : targetDateStart;

      // === BATCH 1: All independent queries ===
      let callLogsQueryBuilder = supabase
        .from('call_logs')
        .select('initiated_by, conversation_duration, demandcom_id')
        .not('initiated_by', 'is', null);
      if (normalizedStartDate) callLogsQueryBuilder = callLogsQueryBuilder.gte('created_at', normalizedStartDate.toISOString());
      if (normalizedEndDate) callLogsQueryBuilder = callLogsQueryBuilder.lte('created_at', normalizedEndDate.toISOString());

      let agentRegistrationsQueryBuilder = supabase
        .from('demandcom_field_changes')
        .select('changed_by, demandcom_id')
        .eq('field_name', 'disposition')
        .eq('new_value', 'Connected')
        .not('changed_by', 'is', null);
      if (normalizedStartDate) agentRegistrationsQueryBuilder = agentRegistrationsQueryBuilder.gte('changed_at', normalizedStartDate.toISOString());
      if (normalizedEndDate) agentRegistrationsQueryBuilder = agentRegistrationsQueryBuilder.lte('changed_at', normalizedEndDate.toISOString());

      let bulkRegistrationsQueryBuilder = supabase
        .from('demandcom')
        .select('id, assigned_to')
        .eq('latest_subdisposition', 'Registered')
        .not('assigned_to', 'is', null);
      if (projectFilter) bulkRegistrationsQueryBuilder = bulkRegistrationsQueryBuilder.eq('activity_name', projectFilter);
      if (normalizedStartDate) bulkRegistrationsQueryBuilder = bulkRegistrationsQueryBuilder.gte('updated_at', normalizedStartDate.toISOString());
      if (normalizedEndDate) bulkRegistrationsQueryBuilder = bulkRegistrationsQueryBuilder.lte('updated_at', normalizedEndDate.toISOString());

      // Also get users who set dispositions in the date range (so they appear in agent performance)
      let dispositionChangersQueryBuilder = supabase
        .from('demandcom_field_changes')
        .select('changed_by')
        .eq('field_name', 'disposition')
        .not('changed_by', 'is', null);
      if (normalizedStartDate) dispositionChangersQueryBuilder = dispositionChangersQueryBuilder.gte('changed_at', normalizedStartDate.toISOString());
      if (normalizedEndDate) dispositionChangersQueryBuilder = dispositionChangersQueryBuilder.lte('changed_at', normalizedEndDate.toISOString());

      const [
        teamMembersResult,
        callersResult,
        callLogsResult,
        dailyTargetsResult,
        agentConvertedResult,
        allAgentConvertedEverResult,
        bulkRegistrationsResult,
        dispositionChangersResult,
      ] = await Promise.all([
        /* 0 */ supabase.from('team_members').select('user_id, teams!inner(name)').eq('teams.name', 'Demandcom-Calling'),
        /* 1 */ supabase.from('call_logs').select('initiated_by').not('initiated_by', 'is', null),
        /* 2 */ callLogsQueryBuilder,
        /* 3 */ supabase.from('demandcom_daily_targets').select('user_id, registration_target')
          .gte('target_date', targetDateStart).lte('target_date', targetDateEnd),
        /* 4 */ agentRegistrationsQueryBuilder,
        /* 5 */ supabase.from('demandcom_field_changes').select('demandcom_id')
          .eq('field_name', 'disposition').eq('new_value', 'Connected'),
        /* 6 */ bulkRegistrationsQueryBuilder,
        /* 7 */ dispositionChangersQueryBuilder,
      ]);

      // Merge agent IDs from team members + callers + disposition changers
      const dbTeamMemberIds = new Set(teamMembersResult.data?.map((tm: any) => tm.user_id) || []);
      const callerIds = new Set(callersResult.data?.map((c: any) => c.initiated_by).filter(Boolean) || []);
      const dispositionChangerIds = new Set(dispositionChangersResult.data?.map((d: any) => d.changed_by).filter(Boolean) || []);
      let allAgentIds = [...new Set([...dbTeamMemberIds, ...callerIds, ...dispositionChangerIds])];

      if (teamMemberIds && teamMemberIds.length > 0) {
        const filterSet = new Set(teamMemberIds);
        allAgentIds = allAgentIds.filter(id => filterSet.has(id));
      }

      if (allAgentIds.length === 0) return [];

      // === BATCH 2: Queries that depend on allAgentIds ===
      let dispositionQueryBuilder = supabase
        .from('demandcom_field_changes')
        .select('changed_by, demandcom_id, new_value')
        .eq('field_name', 'disposition')
        .in('changed_by', allAgentIds);
      if (normalizedStartDate) dispositionQueryBuilder = dispositionQueryBuilder.gte('changed_at', normalizedStartDate.toISOString());
      if (normalizedEndDate) dispositionQueryBuilder = dispositionQueryBuilder.lte('changed_at', normalizedEndDate.toISOString());

      let dbUpdatesQueryBuilder = supabase
        .from('demandcom_field_changes')
        .select('changed_by')
        .eq('field_name', 'disposition')
        .in('new_value', ['Partially Validate', 'Fully Validate'])
        .in('changed_by', allAgentIds);
      if (normalizedStartDate) dbUpdatesQueryBuilder = dbUpdatesQueryBuilder.gte('changed_at', normalizedStartDate.toISOString());
      if (normalizedEndDate) dbUpdatesQueryBuilder = dbUpdatesQueryBuilder.lte('changed_at', normalizedEndDate.toISOString());

      const [profilesResult, dispositionResult, dbUpdatesResult] = await Promise.all([
        supabase.from('profiles').select('id, full_name').in('id', allAgentIds),
        dispositionQueryBuilder,
        dbUpdatesQueryBuilder,
      ]);

      const profileMap = new Map(profilesResult.data?.map((p: any) => [p.id, p.full_name || 'Unknown']) || []);

      // Process call logs and dispositions
      const callLogs = callLogsResult.data || [];
      const dispositionChanges = dispositionResult.data || [];
      let filteredCallLogs = callLogs;
      let filteredDispositions = dispositionChanges;

      // Apply project filter if needed
      if (projectFilter && (callLogs.length || dispositionChanges.length)) {
        const allDemandcomIds = [
          ...new Set([
            ...callLogs.map((c: any) => c.demandcom_id).filter(Boolean),
            ...dispositionChanges.map((d: any) => d.demandcom_id).filter(Boolean)
          ])
        ];

        if (allDemandcomIds.length > 0) {
          const { data: demandcomRecords } = await supabase
            .from('demandcom')
            .select('id, activity_name')
            .in('id', allDemandcomIds)
            .eq('activity_name', projectFilter);

          const validDemandcomIds = new Set(demandcomRecords?.map((d: any) => d.id) || []);
          filteredCallLogs = callLogs.filter((c: any) => c.demandcom_id && validDemandcomIds.has(c.demandcom_id));
          filteredDispositions = dispositionChanges.filter((d: any) => d.demandcom_id && validDemandcomIds.has(d.demandcom_id));
        } else {
          filteredCallLogs = [];
          filteredDispositions = [];
        }
      }

      // Aggregate call metrics per agent (from both call_logs and disposition changes)
      const callMetrics = new Map<string, {
        callLogCalls: number; dispositionCalls: number; connectedCalls: number;
        callsWithDuration: number; totalDuration: number;
      }>();

      for (const agentId of allAgentIds) {
        callMetrics.set(agentId, { callLogCalls: 0, dispositionCalls: 0, connectedCalls: 0, callsWithDuration: 0, totalDuration: 0 });
      }

      // Count from call_logs (actual phone calls)
      for (const call of filteredCallLogs) {
        const agentId = call.initiated_by;
        if (!agentId) continue;
        const existing = callMetrics.get(agentId);
        if (existing) {
          existing.callLogCalls++;
          if (call.conversation_duration && call.conversation_duration > 0) {
            existing.callsWithDuration++;
            existing.totalDuration += call.conversation_duration;
          }
        }
      }

      // Count from disposition changes
      for (const change of filteredDispositions) {
        const agentId = change.changed_by;
        if (!agentId) continue;
        const existing = callMetrics.get(agentId);
        if (existing) {
          existing.dispositionCalls++;
          if (change.new_value && !nonConnectedDispositions.includes(change.new_value)) {
            existing.connectedCalls++;
          }
        }
      }

      // Process daily targets
      const targetMap = new Map<string, number>();
      for (const target of dailyTargetsResult.data || []) {
        const current = targetMap.get(target.user_id) || 0;
        targetMap.set(target.user_id, current + (target.registration_target || 0));
      }

      // Process agent-converted registrations
      const agentConvertedChanges = agentConvertedResult.data || [];
      const agentConvertedDemandcomIds = [...new Set(agentConvertedChanges.map((c: any) => c.demandcom_id).filter(Boolean))];

      const agentRegistrationsMap = new Map<string, number>();
      const allAgentConvertedIds = new Set(allAgentConvertedEverResult.data?.map((c: any) => c.demandcom_id).filter(Boolean) || []);

      if (agentConvertedDemandcomIds.length > 0) {
        let demandcomQuery = supabase
          .from('demandcom')
          .select('id, latest_subdisposition, activity_name')
          .in('id', agentConvertedDemandcomIds)
          .eq('latest_subdisposition', 'Registered');
        if (projectFilter) demandcomQuery = demandcomQuery.eq('activity_name', projectFilter);

        const { data: registeredDemandcom } = await demandcomQuery;
        const validDemandcomIds = new Set(registeredDemandcom?.map((d: any) => d.id) || []);

        for (const change of agentConvertedChanges) {
          if (change.demandcom_id && validDemandcomIds.has(change.demandcom_id) && change.changed_by) {
            agentRegistrationsMap.set(change.changed_by, (agentRegistrationsMap.get(change.changed_by) || 0) + 1);
          }
        }
      }

      // Process bulk registrations
      const bulkRegistrationsMap = new Map<string, number>();
      for (const reg of bulkRegistrationsResult.data || []) {
        if (allAgentConvertedIds.has(reg.id)) continue;
        if (reg.assigned_to) {
          bulkRegistrationsMap.set(reg.assigned_to, (bulkRegistrationsMap.get(reg.assigned_to) || 0) + 1);
        }
      }

      // Combine registrations
      const registrationMap = new Map<string, number>();
      for (const [agentId, count] of agentRegistrationsMap) {
        registrationMap.set(agentId, (registrationMap.get(agentId) || 0) + count);
      }
      for (const [agentId, count] of bulkRegistrationsMap) {
        registrationMap.set(agentId, (registrationMap.get(agentId) || 0) + count);
      }

      // Process DB updates
      const dbUpdatesMap = new Map<string, number>();
      for (const change of dbUpdatesResult.data || []) {
        if (change.changed_by) {
          dbUpdatesMap.set(change.changed_by, (dbUpdatesMap.get(change.changed_by) || 0) + 1);
        }
      }

      // Build final report
      const report: AgentCallReport[] = [];

      for (const agentId of allAgentIds) {
        const metrics = callMetrics.get(agentId) || { callLogCalls: 0, dispositionCalls: 0, connectedCalls: 0, callsWithDuration: 0, totalDuration: 0 };
        const target = targetMap.get(agentId) || 0;
        const regs = registrationMap.get(agentId) || 0;
        const dbUpdates = dbUpdatesMap.get(agentId) || 0;
        // Use the higher of call_logs count and disposition count as totalCalls
        const totalCalls = Math.max(metrics.callLogCalls, metrics.dispositionCalls);
        const connectedCalls = metrics.connectedCalls;

        if (totalCalls === 0 && target === 0 && regs === 0 && dbUpdates === 0) continue;

        const avgDuration = metrics.callsWithDuration > 0 ? metrics.totalDuration / metrics.callsWithDuration : 0;
        const targetAchievement = target > 0 ? (regs / target) * 100 : 0;
        const conversionRate = totalCalls > 0 ? (regs / totalCalls) * 100 : 0;

        report.push({
          userId: agentId,
          name: profileMap.get(agentId) || 'Unknown',
          totalCalls,
          connectedCalls,
          avgDuration,
          target,
          registrations: regs,
          targetAchievement,
          conversionRate,
          dbUpdates,
        });
      }

      report.sort((a, b) => b.totalCalls - a.totalCalls);
      return report;
    },
  });
}
