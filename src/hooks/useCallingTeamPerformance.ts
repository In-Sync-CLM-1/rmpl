import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CallingTeamMember {
  id: string;
  name: string;
  totalCalls: number;
  connectedCalls: number;
  dispositionCounts: {
    interested: number;
    registered: number;
    notInterested: number;
    followUp: number;
    callBack: number;
    rnr: number;
    busy: number;
    switchedOff: number;
    connected: number;
    companyClosed: number;
    cpnf: number;
    doNotCall: number;
    duplicate: number;
    fullyValidate: number;
    ivc: number;
    languageProblem: number;
    lto: number;
    newContactUpdated: number;
    noResponse: number;
    partiallyValidate: number;
    prospect: number;
    wrongNumber: number;
  };
  performance: 'High' | 'Moderate' | 'Low' | 'No Activity';
}

interface UseCallingTeamPerformanceParams {
  startDate?: Date;
  endDate?: Date;
}

export function useCallingTeamPerformance({ startDate, endDate }: UseCallingTeamPerformanceParams = {}) {
  return useQuery({
    queryKey: ['calling-team-performance', startDate?.toISOString(), endDate?.toISOString()],
    staleTime: 3 * 60 * 1000, // 3 minutes
    queryFn: async (): Promise<CallingTeamMember[]> => {
      // Get ONLY Demandcom-Calling team members (strict team membership)
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('user_id, teams!inner(name)')
        .eq('teams.name', 'Demandcom-Calling')
        .eq('is_active', true);
      
      const teamMemberIds = teamMembers?.map(tm => tm.user_id) || [];
      
      // Use only team members - don't include other callers
      if (teamMemberIds.length === 0) return [];

      // Get profiles for team members only
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', teamMemberIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name || 'Unknown']) || []);

      // Get disposition changes made by team members (with demandcom_id for deduplication)
      let dispositionQuery = supabase
        .from('demandcom_field_changes')
        .select('changed_by, new_value, demandcom_id')
        .eq('field_name', 'disposition')
        .in('changed_by', teamMemberIds);
      
      if (startDate) {
        dispositionQuery = dispositionQuery.gte('changed_at', startDate.toISOString());
      }
      if (endDate) {
        dispositionQuery = dispositionQuery.lte('changed_at', endDate.toISOString());
      }

      const { data: dispositionChanges } = await dispositionQuery;

      // Get call logs for team members (with demandcom_id for deduplication)
      let callLogsQuery = supabase
        .from('call_logs')
        .select('initiated_by, conversation_duration, demandcom_id')
        .in('initiated_by', teamMemberIds);
      
      if (startDate) {
        callLogsQuery = callLogsQuery.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        callLogsQuery = callLogsQuery.lte('created_at', endDate.toISOString());
      }

      const { data: callLogs } = await callLogsQuery;

      // Aggregate data per agent using unique demandcom_ids to avoid double-counting
      const agentStats = new Map<string, {
        uniqueDemandcomIds: Set<string>;
        connectedCalls: number;
        dispositionCounts: {
          interested: number;
          registered: number;
          notInterested: number;
          followUp: number;
          callBack: number;
          rnr: number;
          busy: number;
          switchedOff: number;
          connected: number;
          companyClosed: number;
          cpnf: number;
          doNotCall: number;
          duplicate: number;
          fullyValidate: number;
          ivc: number;
          languageProblem: number;
          lto: number;
          newContactUpdated: number;
          noResponse: number;
          partiallyValidate: number;
          prospect: number;
          wrongNumber: number;
        };
      }>();

      // Initialize stats for team members only
      for (const agentId of teamMemberIds) {
        agentStats.set(agentId, {
          uniqueDemandcomIds: new Set<string>(),
          connectedCalls: 0,
          dispositionCounts: {
            interested: 0,
            registered: 0,
            notInterested: 0,
            followUp: 0,
            callBack: 0,
            rnr: 0,
            busy: 0,
            switchedOff: 0,
            connected: 0,
            companyClosed: 0,
            cpnf: 0,
            doNotCall: 0,
            duplicate: 0,
            fullyValidate: 0,
            ivc: 0,
            languageProblem: 0,
            lto: 0,
            newContactUpdated: 0,
            noResponse: 0,
            partiallyValidate: 0,
            prospect: 0,
            wrongNumber: 0,
          },
        });
      }

      // Process call logs - add demandcom_id to unique set and track connected calls
      for (const call of callLogs || []) {
        const agentId = call.initiated_by;
        if (!agentId) continue;
        
        const stats = agentStats.get(agentId);
        if (stats) {
          // Add demandcom_id to unique set (avoids double-counting)
          if (call.demandcom_id) {
            stats.uniqueDemandcomIds.add(call.demandcom_id);
          }
          if (call.conversation_duration && call.conversation_duration > 0) {
            stats.connectedCalls++;
          }
        }
      }

      // Process disposition changes - add demandcom_id to unique set
      for (const change of dispositionChanges || []) {
        const agentId = change.changed_by;
        if (!agentId) continue;
        
        const stats = agentStats.get(agentId);
        if (!stats) continue;

        // Add demandcom_id to unique set (avoids double-counting)
        if (change.demandcom_id) {
          stats.uniqueDemandcomIds.add(change.demandcom_id);
        }

        const disposition = change.new_value?.toLowerCase() || '';
        
        // Use .includes() for flexible matching of disposition variations
        // Check "not interested" BEFORE "interested" to avoid false positives
        if (disposition.includes('not interested') || disposition === 'ni') {
          stats.dispositionCounts.notInterested++;
        } else if (disposition === 'interested' || (disposition.includes('interested') && !disposition.includes('not'))) {
          stats.dispositionCounts.interested++;
        } else if (disposition === 'registered' || disposition.includes('registered')) {
          stats.dispositionCounts.registered++;
        } else if (disposition.includes('follow up') || disposition === 'fu') {
          stats.dispositionCounts.followUp++;
        } else if (disposition.includes('call back') || disposition === 'cb') {
          stats.dispositionCounts.callBack++;
        } else if (disposition.includes('ringing') || disposition === 'rnr') {
          stats.dispositionCounts.rnr++;
        } else if (disposition === 'busy' || disposition.includes('busy')) {
          stats.dispositionCounts.busy++;
        } else if (disposition.includes('switched off') || disposition === 'so') {
          stats.dispositionCounts.switchedOff++;
        } else if (disposition === 'connected') {
          stats.dispositionCounts.connected++;
        } else if (disposition.includes('company closed') || disposition === 'cc') {
          stats.dispositionCounts.companyClosed++;
        } else if (disposition.includes('contact person not found') || disposition === 'cpnf' || disposition.includes('cpnf')) {
          stats.dispositionCounts.cpnf++;
        } else if (disposition.includes('do not call') || disposition === 'dnc') {
          stats.dispositionCounts.doNotCall++;
        } else if (disposition === 'duplicate' || disposition.includes('duplicate')) {
          stats.dispositionCounts.duplicate++;
        } else if (disposition.includes('fully validate') || disposition.includes('fully validated')) {
          stats.dispositionCounts.fullyValidate++;
        } else if (disposition.includes('invalid') || disposition === 'ivc' || disposition.includes('ivc')) {
          stats.dispositionCounts.ivc++;
        } else if (disposition.includes('language problem') || disposition === 'lp' || disposition.includes('lp (')) {
          stats.dispositionCounts.languageProblem++;
        } else if (disposition.includes('left the organization') || disposition === 'lto') {
          stats.dispositionCounts.lto++;
        } else if (disposition.includes('new contact updated') || disposition === 'ncu') {
          stats.dispositionCounts.newContactUpdated++;
        } else if (disposition.includes('no response') || disposition === 'nr' || disposition.includes('nr (')) {
          stats.dispositionCounts.noResponse++;
        } else if (disposition.includes('partially validate') || disposition.includes('partially validated')) {
          stats.dispositionCounts.partiallyValidate++;
        } else if (disposition === 'prospect' || disposition.includes('prospect')) {
          stats.dispositionCounts.prospect++;
        } else if (disposition.includes('wrong number') || disposition === 'wn') {
          stats.dispositionCounts.wrongNumber++;
        } else if (disposition.includes('meeting')) {
          // Handle "meeting schedule" and similar
          stats.dispositionCounts.interested++;
        }
      }

      // Build report for team members only
      const report: CallingTeamMember[] = [];
      
      for (const agentId of teamMemberIds) {
        const stats = agentStats.get(agentId);
        if (!stats) continue;
        
        // Total calls = unique demandcom_ids the agent interacted with
        const totalCalls = stats.uniqueDemandcomIds.size;
        
        // Calculate total dispositions for performance rating
        const totalDispositions = Object.values(stats.dispositionCounts).reduce((a, b) => a + b, 0);
        
        // Determine performance based on total calls and conversions
        let performance: CallingTeamMember['performance'];
        if (totalCalls === 0 && totalDispositions === 0) {
          performance = 'No Activity';
        } else if (totalCalls >= 100 || (stats.dispositionCounts.interested + stats.dispositionCounts.registered) >= 10) {
          performance = 'High';
        } else if (totalCalls >= 50 || (stats.dispositionCounts.interested + stats.dispositionCounts.registered) >= 5) {
          performance = 'Moderate';
        } else {
          performance = 'Low';
        }

        // Only include if there's some activity
        if (totalCalls > 0 || totalDispositions > 0) {
          report.push({
            id: agentId,
            name: profileMap.get(agentId) || 'Unknown',
            totalCalls,
            connectedCalls: stats.connectedCalls,
            dispositionCounts: stats.dispositionCounts,
            performance,
          });
        }
      }

      // Sort by total calls descending
      report.sort((a, b) => b.totalCalls - a.totalCalls);

      return report;
    },
  });
}
