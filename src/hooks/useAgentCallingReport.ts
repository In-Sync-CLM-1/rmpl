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
      // 1. Get all Demandcom-Calling team members
      const { data: dbTeamMembers } = await supabase
        .from('team_members')
        .select('user_id, teams!inner(name)')
        .eq('teams.name', 'Demandcom-Calling');
      
      const dbTeamMemberIds = new Set(dbTeamMembers?.map(tm => tm.user_id) || []);

      // 2. Get all unique callers from call_logs
      const { data: callers } = await supabase
        .from('call_logs')
        .select('initiated_by')
        .not('initiated_by', 'is', null);
      
      const callerIds = new Set(callers?.map(c => c.initiated_by).filter(Boolean) || []);

      // 3. Merge both sets, then filter by teamMemberIds if provided
      let allAgentIds = [...new Set([...dbTeamMemberIds, ...callerIds])];
      
      // If teamMemberIds filter is provided, only include those agents
      if (teamMemberIds && teamMemberIds.length > 0) {
        const filterSet = new Set(teamMemberIds);
        allAgentIds = allAgentIds.filter(id => filterSet.has(id));
      }
      
      if (allAgentIds.length === 0) return [];

      // 4. Get profiles for all agents
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', allAgentIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name || 'Unknown']) || []);

      // Normalize dates to start/end of day for proper filtering
      const normalizedStartDate = startDate ? startOfDay(startDate) : undefined;
      const normalizedEndDate = endDate ? endOfDay(endDate) : undefined;

      // 5. Get call logs - potentially filtered by project
      let callLogsQuery = supabase
        .from('call_logs')
        .select('initiated_by, conversation_duration, demandcom_id')
        .not('initiated_by', 'is', null);
      
      if (normalizedStartDate) {
        callLogsQuery = callLogsQuery.gte('created_at', normalizedStartDate.toISOString());
      }
      if (normalizedEndDate) {
        callLogsQuery = callLogsQuery.lte('created_at', normalizedEndDate.toISOString());
      }

      const { data: callLogs } = await callLogsQuery;

      // 5b. Get disposition changes - include new_value to identify connected vs non-connected
      let dispositionQuery = supabase
        .from('demandcom_field_changes')
        .select('changed_by, demandcom_id, new_value')
        .eq('field_name', 'disposition')
        .in('changed_by', allAgentIds);
      
      if (normalizedStartDate) {
        dispositionQuery = dispositionQuery.gte('changed_at', normalizedStartDate.toISOString());
      }
      if (normalizedEndDate) {
        dispositionQuery = dispositionQuery.lte('changed_at', normalizedEndDate.toISOString());
      }

      const { data: dispositionChanges } = await dispositionQuery;

      // Define NON-connected dispositions (only NR - No Response)
      const nonConnectedDispositions = ['NR ( No Response )'];

      // If project filter is set, we need to filter call_logs by demandcom activity_name
      let filteredCallLogs = callLogs || [];
      let filteredDispositions = dispositionChanges || [];
      
      if (projectFilter && (callLogs?.length || dispositionChanges?.length)) {
        // Get all demandcom_ids from both sources
        const allDemandcomIds = [
          ...new Set([
            ...(callLogs?.map(c => c.demandcom_id).filter(Boolean) || []),
            ...(dispositionChanges?.map(d => d.demandcom_id).filter(Boolean) || [])
          ])
        ];
        
        if (allDemandcomIds.length > 0) {
          const { data: demandcomRecords } = await supabase
            .from('demandcom')
            .select('id, activity_name')
            .in('id', allDemandcomIds)
            .eq('activity_name', projectFilter);
          
          const validDemandcomIds = new Set(demandcomRecords?.map(d => d.id) || []);
          filteredCallLogs = (callLogs || []).filter(c => c.demandcom_id && validDemandcomIds.has(c.demandcom_id));
          filteredDispositions = (dispositionChanges || []).filter(d => d.demandcom_id && validDemandcomIds.has(d.demandcom_id));
        } else {
          filteredCallLogs = [];
          filteredDispositions = [];
        }
      }

      // 6. Aggregate call metrics per agent - count all disposition changes
      const callMetrics = new Map<string, { 
        totalCalls: number;        // All disposition changes
        connectedCalls: number;    // Disposition changes excluding NR
        callsWithDuration: number; 
        totalDuration: number 
      }>();
      
      // Initialize for all agents
      for (const agentId of allAgentIds) {
        callMetrics.set(agentId, { totalCalls: 0, connectedCalls: 0, callsWithDuration: 0, totalDuration: 0 });
      }
      
      // Process call logs - for duration tracking only
      for (const call of filteredCallLogs) {
        const agentId = call.initiated_by;
        if (!agentId) continue;
        
        const existing = callMetrics.get(agentId);
        if (existing) {
          // Track duration separately for avgDuration calculation
          if (call.conversation_duration && call.conversation_duration > 0) {
            existing.callsWithDuration++;
            existing.totalDuration += call.conversation_duration;
          }
        }
      }
      
      // Process disposition changes - count each change as a call
      for (const change of filteredDispositions) {
        const agentId = change.changed_by;
        if (!agentId) continue;
        
        const existing = callMetrics.get(agentId);
        if (existing) {
          // Count each disposition change as a call
          existing.totalCalls++;
          
          // Count as connected if NOT in nonConnectedDispositions
          if (change.new_value && !nonConnectedDispositions.includes(change.new_value)) {
            existing.connectedCalls++;
          }
        }
      }

      // 7. Get daily registration targets from demandcom_daily_targets for the date range
      const targetDateStart = startDate ? startDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      const targetDateEnd = endDate ? endDate.toISOString().split('T')[0] : targetDateStart;
      
      const { data: dailyTargets } = await supabase
        .from('demandcom_daily_targets')
        .select('user_id, registration_target')
        .gte('target_date', targetDateStart)
        .lte('target_date', targetDateEnd);
      
      // Sum targets per user across the date range
      const targetMap = new Map<string, number>();
      for (const target of dailyTargets || []) {
        const current = targetMap.get(target.user_id) || 0;
        targetMap.set(target.user_id, current + (target.registration_target || 0));
      }

      // 8. HYBRID APPROACH: Get registrations from BOTH sources
      
      // 8a. Agent-converted registrations: disposition changed to 'Connected' for leads with subdisposition='Registered'
      // This tracks when an agent makes a call and converts a lead to registration
      let agentRegistrationsQuery = supabase
        .from('demandcom_field_changes')
        .select('changed_by, demandcom_id')
        .eq('field_name', 'disposition')
        .eq('new_value', 'Connected')
        .not('changed_by', 'is', null);

      if (normalizedStartDate) {
        agentRegistrationsQuery = agentRegistrationsQuery.gte('changed_at', normalizedStartDate.toISOString());
      }
      if (normalizedEndDate) {
        agentRegistrationsQuery = agentRegistrationsQuery.lte('changed_at', normalizedEndDate.toISOString());
      }

      const { data: agentConvertedChanges } = await agentRegistrationsQuery;

      // Get demandcom records to check subdisposition and activity_name
      const agentConvertedDemandcomIds = [...new Set(agentConvertedChanges?.map(c => c.demandcom_id).filter(Boolean) || [])];
      
      let agentRegistrationsMap = new Map<string, number>();
      const processedDemandcomIds = new Set<string>(); // Track which demandcom_ids are agent-converted
      
      if (agentConvertedDemandcomIds.length > 0) {
        let demandcomQuery = supabase
          .from('demandcom')
          .select('id, latest_subdisposition, activity_name')
          .in('id', agentConvertedDemandcomIds)
          .eq('latest_subdisposition', 'Registered');
        
        if (projectFilter) {
          demandcomQuery = demandcomQuery.eq('activity_name', projectFilter);
        }
        
        const { data: registeredDemandcom } = await demandcomQuery;
        const validDemandcomIds = new Set(registeredDemandcom?.map(d => d.id) || []);
        
        // Count agent-converted registrations and mark them as processed
        for (const change of agentConvertedChanges || []) {
          if (change.demandcom_id && validDemandcomIds.has(change.demandcom_id) && change.changed_by) {
            const current = agentRegistrationsMap.get(change.changed_by) || 0;
            agentRegistrationsMap.set(change.changed_by, current + 1);
            processedDemandcomIds.add(change.demandcom_id);
          }
        }
      }

      // 8b. Bulk-uploaded registrations: leads with subdisposition='Registered' that have NO agent conversion history
      // These are leads imported with registration status already set (bulk upload scenario)
      // First, get ALL demandcom_ids that have ever had a disposition change to 'Connected'
      // (these are NOT bulk uploads - they were agent-converted at some point)
      const { data: allAgentConvertedEver } = await supabase
        .from('demandcom_field_changes')
        .select('demandcom_id')
        .eq('field_name', 'disposition')
        .eq('new_value', 'Connected');
      
      const allAgentConvertedIds = new Set(allAgentConvertedEver?.map(c => c.demandcom_id).filter(Boolean) || []);

      // Now get bulk registrations - those REGISTERED (updated_at) in date range with NO agent conversion ever
      let bulkRegistrationsQuery = supabase
        .from('demandcom')
        .select('id, assigned_to')
        .eq('latest_subdisposition', 'Registered')
        .not('assigned_to', 'is', null);
      
      if (projectFilter) {
        bulkRegistrationsQuery = bulkRegistrationsQuery.eq('activity_name', projectFilter);
      }
      // Fix: Use updated_at to capture when the registration actually occurred
      if (normalizedStartDate) {
        bulkRegistrationsQuery = bulkRegistrationsQuery.gte('updated_at', normalizedStartDate.toISOString());
      }
      if (normalizedEndDate) {
        bulkRegistrationsQuery = bulkRegistrationsQuery.lte('updated_at', normalizedEndDate.toISOString());
      }

      const { data: bulkRegistrations } = await bulkRegistrationsQuery;
      
      // Count bulk registrations - only those that have NEVER been agent-converted
      const bulkRegistrationsMap = new Map<string, number>();
      for (const reg of bulkRegistrations || []) {
        // Skip if this demandcom_id has EVER been agent-converted (not a true bulk upload)
        if (allAgentConvertedIds.has(reg.id)) continue;
        
        if (reg.assigned_to) {
          const current = bulkRegistrationsMap.get(reg.assigned_to) || 0;
          bulkRegistrationsMap.set(reg.assigned_to, current + 1);
        }
      }

      // 8c. Combine both sources
      const registrationMap = new Map<string, number>();
      
      // Add agent-converted registrations
      for (const [agentId, count] of agentRegistrationsMap) {
        registrationMap.set(agentId, (registrationMap.get(agentId) || 0) + count);
      }
      
      // Add bulk registrations (truly bulk-imported only)
      for (const [agentId, count] of bulkRegistrationsMap) {
        registrationMap.set(agentId, (registrationMap.get(agentId) || 0) + count);
      }

      // 8d. Get Database Updates (PV/FV dispositions)
      let dbUpdatesQuery = supabase
        .from('demandcom_field_changes')
        .select('changed_by')
        .eq('field_name', 'disposition')
        .in('new_value', ['Partially Validate', 'Fully Validate'])
        .in('changed_by', allAgentIds);
      
      if (normalizedStartDate) {
        dbUpdatesQuery = dbUpdatesQuery.gte('changed_at', normalizedStartDate.toISOString());
      }
      if (normalizedEndDate) {
        dbUpdatesQuery = dbUpdatesQuery.lte('changed_at', normalizedEndDate.toISOString());
      }
      
      const { data: dbUpdateChanges } = await dbUpdatesQuery;
      
      const dbUpdatesMap = new Map<string, number>();
      for (const change of dbUpdateChanges || []) {
        if (change.changed_by) {
          dbUpdatesMap.set(change.changed_by, (dbUpdatesMap.get(change.changed_by) || 0) + 1);
        }
      }

      // 9. Build final report
      const report: AgentCallReport[] = [];
      
      for (const agentId of allAgentIds) {
        const metrics = callMetrics.get(agentId) || { totalCalls: 0, connectedCalls: 0, callsWithDuration: 0, totalDuration: 0 };
        const target = targetMap.get(agentId) || 0;
        const regs = registrationMap.get(agentId) || 0;
        const dbUpdates = dbUpdatesMap.get(agentId) || 0;
        
        // Total calls = all disposition changes
        const totalCalls = metrics.totalCalls;
        
        // Connected calls = disposition changes excluding NR
        const connectedCalls = metrics.connectedCalls;
        
        // Only include agents who have calls OR targets OR registrations OR dbUpdates
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

      // Sort by total calls descending
      report.sort((a, b) => b.totalCalls - a.totalCalls);

      return report;
    },
  });
}
