import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subDays, format } from "date-fns";

export interface DemandComDashboardMetrics {
  connectedCallsToday: number;
  totalDataUpdated: number;
  totalRequirement: number;
  registered: number;
  shortagePercentage: string;
  assignedCount: number;
  totalCount: number;
  assignedPercentage: string;
  dispositionBreakdown: Array<{
    disposition: string;
    count: number;
    percentage: number;
  }>;
  dailyTrends: Array<{
    date: string;
    totalCalls: number;
    connectedCalls: number;
  }>;
  topAgents: Array<{
    id: string;
    name: string;
    totalAssigned: number;
    taggedCount: number;
    efficiency: number;
  }>;
  activityStats: Array<{
    projectName: string;
    requiredParticipants: number;
    assignedData: number;
    interestedCount: number;
    registeredCount: number;
    rate: number;
  }>;
  dataTeamStats: Array<{
    id: string;
    name: string;
    recordsUpdated: number;
    otherFieldsUpdated: number;
    updatedFields: {
      disposition: number;
      companyInfo: number;
      contactInfo: number;
      locationInfo: number;
    };
    dispositionCounts: {
      fullyValidate: number;
      partiallyValidate: number;
      companyClosed: number;
      cpnf: number;
      ivc: number;
      lto: number;
    };
  }>;
}

interface UseDemandComDashboardOptions {
  startDate?: Date;
  endDate?: Date;
  activityFilter?: string;
  agentFilter?: string;
  teamMemberIds?: string[];
}

export function useDemandComDashboard(options: UseDemandComDashboardOptions = {}) {
  const { 
    startDate = startOfMonth(new Date()), 
    endDate = endOfMonth(new Date()), 
    activityFilter, 
    agentFilter,
    teamMemberIds,
  } = options;

  // Set times for proper date range filtering
  const startDateTime = new Date(startDate);
  startDateTime.setHours(0, 0, 0, 0);
  
  const endDateTime = new Date(endDate);
  endDateTime.setHours(23, 59, 59, 999);

  return useQuery({
    queryKey: ['demandcom-dashboard', startDateTime.toISOString(), endDateTime.toISOString(), activityFilter, agentFilter, teamMemberIds],
    queryFn: async (): Promise<DemandComDashboardMetrics> => {
      console.log('=== Dashboard Query Debug ===');
      console.log('Start Date:', startDateTime.toISOString());
      console.log('End Date:', endDateTime.toISOString());

      // Connected Calls - using exclusion logic (matches Agent Table)
      // Connected = all disposition changes EXCEPT 'NR ( No Response )'
      const nonConnectedDispositions = ['NR ( No Response )'];
      
      // Build query for connected calls - filter by team if provided
      let connectedCallsQuery = supabase
        .from("demandcom_field_changes")
        .select("*", { count: "exact" })
        .eq("field_name", "disposition")
        .gte("changed_at", startDateTime.toISOString())
        .lte("changed_at", endDateTime.toISOString())
        .not("new_value", "in", `(${nonConnectedDispositions.join(",")})`);
      
      // Filter by team members if provided
      if (teamMemberIds && teamMemberIds.length > 0) {
        connectedCallsQuery = connectedCallsQuery.in("changed_by", teamMemberIds);
      }
      
      const { count: connectedCallsToday } = await connectedCallsQuery;
      // Get KPI metrics - use direct query when teamMemberIds is provided, otherwise use RPC
      let totalCount = 0;
      let assignedCount = 0;
      let registered = 0;
      let totalDataUpdated = 0;

      if (teamMemberIds && teamMemberIds.length > 0) {
        // Direct query with team member filter
        let query = supabase
          .from('demandcom')
          .select('id, assigned_to, latest_subdisposition, updated_at', { count: 'exact' });
        
        if (activityFilter) query = query.eq('activity_name', activityFilter);
        query = query.in('assigned_to', teamMemberIds);
        query = query.gte('created_at', startDateTime.toISOString());
        query = query.lte('created_at', endDateTime.toISOString());
        
        const { data: teamData, count } = await query;
        
        totalCount = count || 0;
        assignedCount = teamData?.filter(d => d.assigned_to !== null).length || 0;
        // Fix: Count registrations based on when they were registered (updated_at), not created_at
        registered = teamData?.filter(d => {
          if (d.latest_subdisposition !== 'Registered') return false;
          const updatedAt = new Date(d.updated_at);
          return updatedAt >= startDateTime && updatedAt <= endDateTime;
        }).length || 0;
        totalDataUpdated = teamData?.filter(d => {
          const updatedAt = new Date(d.updated_at);
          return updatedAt >= startDateTime && updatedAt <= endDateTime;
        }).length || 0;
      } else {
        // Use security definer function (bypasses RLS)
        const { data: kpiData } = await supabase.rpc('get_demandcom_kpi_metrics', {
          p_start_date: startDateTime.toISOString(),
          p_end_date: endDateTime.toISOString(),
          p_activity_filter: activityFilter || null,
          p_agent_filter: agentFilter || null,
          p_today_start: startDateTime.toISOString()
        });

        const kpiMetrics = kpiData?.[0] || { total_count: 0, assigned_count: 0, registered_count: 0, updated_today_count: 0 };
        totalCount = Number(kpiMetrics.total_count) || 0;
        assignedCount = Number(kpiMetrics.assigned_count) || 0;
        registered = Number(kpiMetrics.registered_count) || 0;
        totalDataUpdated = Number(kpiMetrics.updated_today_count) || 0;
      }

      // Get Registration Targets from active projects
      const { data: allProjects } = await supabase
        .from("projects")
        .select("id, status")
        .in("status", ["active", "in_progress"]);

      const activeProjectIds = (allProjects || []).map((p: any) => p.id);

      let totalRequirement = 0;
      if (activeProjectIds.length > 0) {
        const { data: registrationTargets } = await supabase
          .from("project_demandcom_checklist")
          .select("description")
          .eq("checklist_item", "Telecalling - Registration Target")
          .in("project_id", activeProjectIds);

        totalRequirement = (registrationTargets || []).reduce((sum, item: any) => {
          const target = parseInt(item.description || "0");
          return sum + (isNaN(target) ? 0 : target);
        }, 0);
      }

      // Calculate shortage percentage
      const shortage = totalRequirement > 0 
        ? Math.max(0, totalRequirement - registered)
        : 0;
      const shortagePercentage = totalRequirement > 0
        ? ((shortage / totalRequirement) * 100).toFixed(1)
        : "0.0";

      const assignedPercentage = totalCount > 0
        ? ((assignedCount / totalCount) * 100).toFixed(1)
        : "0.0";

      // Get disposition breakdown - use direct query when teamMemberIds is provided
      let dispositionBreakdown: Array<{disposition: string; count: number; percentage: number}> = [];
      
      if (teamMemberIds && teamMemberIds.length > 0) {
        // Direct query with team member filter
        let query = supabase
          .from('demandcom')
          .select('latest_disposition')
          .in('assigned_to', teamMemberIds)
          .not('latest_disposition', 'is', null);
        
        if (activityFilter) query = query.eq('activity_name', activityFilter);
        query = query.gte('created_at', startDateTime.toISOString());
        query = query.lte('created_at', endDateTime.toISOString());
        
        const { data: teamDispositions } = await query;
        
        // Count dispositions
        const dispositionCounts = (teamDispositions || []).reduce((acc: Record<string, number>, d: any) => {
          const disp = d.latest_disposition || 'Unknown';
          acc[disp] = (acc[disp] || 0) + 1;
          return acc;
        }, {});
        
        const total = Object.values(dispositionCounts).reduce((sum: number, c) => sum + (c as number), 0);
        dispositionBreakdown = Object.entries(dispositionCounts).map(([disposition, count]) => ({
          disposition,
          count: count as number,
          percentage: Math.round(((count as number) / (total || 1)) * 100),
        }));
      } else {
        // Use security definer function (bypasses RLS)
        const { data: dispositionData } = await supabase.rpc('get_demandcom_disposition_breakdown', {
          p_start_date: startDateTime.toISOString(),
          p_end_date: endDateTime.toISOString(),
          p_activity_filter: activityFilter || null,
          p_agent_filter: agentFilter || null
        });

        const totalDispositions = (dispositionData || []).reduce((sum: number, d: any) => sum + Number(d.count), 0);
        dispositionBreakdown = (dispositionData || []).map((d: any) => ({
          disposition: d.disposition,
          count: Number(d.count),
          percentage: Math.round((Number(d.count) / (totalDispositions || 1)) * 100),
        }));
      }

      // Get daily calling trends (last 30 days) - based on disposition changes
      const thirtyDaysAgo = subDays(new Date(), 30);
      
      // Fetch all disposition changes in the last 30 days
      let dispositionChangesQuery = supabase
        .from('demandcom_field_changes')
        .select('changed_at, new_value, changed_by')
        .eq('field_name', 'disposition')
        .gte('changed_at', thirtyDaysAgo.toISOString());
      
      // Filter by team members if provided
      if (teamMemberIds && teamMemberIds.length > 0) {
        dispositionChangesQuery = dispositionChangesQuery.in('changed_by', teamMemberIds);
      }
      
      const { data: dispositionChanges } = await dispositionChangesQuery;

      // Non-connected disposition (using exclusion logic - matches Agent Table)
      const nonConnectedDispositionsForTrend = ['NR ( No Response )'];

      const dailyTrends = Array.from({ length: 30 }, (_, i) => {
        const date = subDays(new Date(), 29 - i);
        const dateStr = format(date, 'yyyy-MM-dd');
        
        const dayChanges = dispositionChanges?.filter(d => 
          format(new Date(d.changed_at), 'yyyy-MM-dd') === dateStr
        ) || [];
        
        // Total calls = all disposition changes
        const totalCalls = dayChanges.length;
        
        // Connected calls = all except 'NR ( No Response )'
        const connectedCalls = dayChanges.filter(d => 
          !nonConnectedDispositionsForTrend.includes(d.new_value || '')
        ).length;
        
        return {
          date: dateStr,
          totalCalls,
          connectedCalls,
        };
      });

      // Get agent stats - filter by team members if provided
      let topAgents: Array<{id: string; name: string; totalAssigned: number; taggedCount: number; efficiency: number}> = [];
      
      if (teamMemberIds && teamMemberIds.length > 0) {
        // Get profiles for team members
        const { data: teamProfiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', teamMemberIds);
        
        // Get assignment counts for team members
        const { data: teamAssignments } = await supabase
          .from('demandcom')
          .select('assigned_to, latest_disposition')
          .in('assigned_to', teamMemberIds);
        
        // Build agent stats
        const agentStatsMap = new Map<string, {name: string; totalAssigned: number; taggedCount: number}>();
        teamProfiles?.forEach(p => {
          agentStatsMap.set(p.id, { name: p.full_name || 'Unknown', totalAssigned: 0, taggedCount: 0 });
        });
        
        teamAssignments?.forEach(a => {
          const stats = agentStatsMap.get(a.assigned_to);
          if (stats) {
            stats.totalAssigned++;
            if (a.latest_disposition) stats.taggedCount++;
          }
        });
        
        topAgents = Array.from(agentStatsMap.entries()).map(([id, stats]) => ({
          id,
          name: stats.name,
          totalAssigned: stats.totalAssigned,
          taggedCount: stats.taggedCount,
          efficiency: stats.totalAssigned > 0 ? Math.round((stats.taggedCount / stats.totalAssigned) * 100) : 0,
        })).sort((a, b) => b.efficiency - a.efficiency);
      } else {
        // Use security definer function (bypasses RLS)
        const { data: agentStatsData } = await supabase.rpc('get_demandcom_agent_stats', {
          p_team_name: 'Demandcom-Calling'
        });

        topAgents = (agentStatsData || [])
          .map((agent: any) => ({
            id: agent.agent_id,
            name: agent.agent_name || 'Unknown',
            totalAssigned: Number(agent.total_assigned) || 0,
            taggedCount: Number(agent.tagged_count) || 0,
            efficiency: agent.total_assigned > 0
              ? Math.round((Number(agent.tagged_count) / Number(agent.total_assigned)) * 100)
              : 0,
          }))
          .sort((a: any, b: any) => b.efficiency - a.efficiency);
      }

      // Get all Execution stage projects with their demandcom stats
      const { data: executionStats } = await supabase.rpc('get_execution_project_stats');

      // Build activity stats from the RPC result
      const activityStats = (executionStats || []).map((stat: any) => {
        const assignedData = Number(stat.assigned_data) || 0;
        const interestedCount = Number(stat.interested_count) || 0;
        const registeredCount = Number(stat.registered_count) || 0;
        const rate = assignedData > 0 ? Math.round(((interestedCount + registeredCount) / assignedData) * 100) : 0;
        
        return {
          projectName: stat.project_name,
          requiredParticipants: stat.required_participants || 0,
          assignedData,
          interestedCount,
          registeredCount,
          rate,
        };
      });

      // Get Data Team member stats from the aggregated daily performance table
      // Only include members of Demandcom-Database team
      const { data: dataTeamMembers } = await supabase
        .from('team_members')
        .select('user_id, teams!inner(name)')
        .eq('teams.name', 'Demandcom-Database')
        .eq('is_active', true);
      
      const dataTeamMemberIds = dataTeamMembers?.map(tm => tm.user_id) || [];
      
      // Get profile info for these members
      const { data: dataTeamProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', dataTeamMemberIds);

      // Get aggregated performance data from the new table
      const startDateStr = format(startDateTime, 'yyyy-MM-dd');
      const endDateStr = format(endDateTime, 'yyyy-MM-dd');
      
      const { data: performanceData } = await supabase
        .from('demandcom_daily_performance')
        .select('*')
        .in('user_id', dataTeamMemberIds)
        .gte('performance_date', startDateStr)
        .lte('performance_date', endDateStr);

      // Aggregate performance data per user
      const performanceMap = new Map<string, {
        fullyValidate: number;
        partiallyValidate: number;
        companyClosed: number;
        cpnf: number;
        ivc: number;
        lto: number;
        companyInfo: number;
        contactInfo: number;
        locationInfo: number;
        otherFields: number;
        totalRecords: number;
      }>();

      (performanceData || []).forEach((row: any) => {
        const existing = performanceMap.get(row.user_id) || {
          fullyValidate: 0,
          partiallyValidate: 0,
          companyClosed: 0,
          cpnf: 0,
          ivc: 0,
          lto: 0,
          companyInfo: 0,
          contactInfo: 0,
          locationInfo: 0,
          otherFields: 0,
          totalRecords: 0,
        };
        
        performanceMap.set(row.user_id, {
          fullyValidate: existing.fullyValidate + (row.disposition_fully_validate || 0),
          partiallyValidate: existing.partiallyValidate + (row.disposition_partially_validate || 0),
          companyClosed: existing.companyClosed + (row.disposition_company_closed || 0),
          cpnf: existing.cpnf + (row.disposition_cpnf || 0),
          ivc: existing.ivc + (row.disposition_ivc || 0),
          lto: existing.lto + (row.disposition_lto || 0),
          companyInfo: existing.companyInfo + (row.company_info_updates || 0),
          contactInfo: existing.contactInfo + (row.contact_info_updates || 0),
          locationInfo: existing.locationInfo + (row.location_info_updates || 0),
          otherFields: existing.otherFields + (row.other_field_updates || 0),
          totalRecords: existing.totalRecords + (row.total_records_updated || 0),
        });
      });

      // Build data team stats from profiles and performance data
      const dataTeamStats = (dataTeamProfiles || [])
        .filter((profile: any) => profile.full_name !== 'Jatinder Mahajan')
        .map((profile: any) => {
          const perf = performanceMap.get(profile.id) || {
            fullyValidate: 0, partiallyValidate: 0, companyClosed: 0,
            cpnf: 0, ivc: 0, lto: 0,
            companyInfo: 0, contactInfo: 0, locationInfo: 0, otherFields: 0, totalRecords: 0,
          };
          
          const dispositionCounts = {
            fullyValidate: perf.fullyValidate,
            partiallyValidate: perf.partiallyValidate,
            companyClosed: perf.companyClosed,
            cpnf: perf.cpnf,
            ivc: perf.ivc,
            lto: perf.lto,
          };
          
          const recordsUpdated = Object.values(dispositionCounts).reduce((sum, val) => sum + val, 0);
          const otherFieldsUpdated = perf.companyInfo + perf.contactInfo + perf.locationInfo;
          
          return {
            id: profile.id,
            name: profile.full_name || 'Unknown',
            recordsUpdated,
            otherFieldsUpdated,
            updatedFields: {
              disposition: perf.fullyValidate + perf.partiallyValidate + perf.companyClosed + perf.cpnf + perf.ivc + perf.lto,
              companyInfo: perf.companyInfo,
              contactInfo: perf.contactInfo,
              locationInfo: perf.locationInfo,
            },
            dispositionCounts,
          };
        })
        .sort((a: any, b: any) => b.recordsUpdated - a.recordsUpdated);

      return {
        connectedCallsToday: connectedCallsToday || 0,
        totalDataUpdated: totalDataUpdated || 0,
        totalRequirement,
        registered: registered || 0,
        shortagePercentage,
        assignedCount: assignedCount || 0,
        totalCount: totalCount || 0,
        assignedPercentage,
        dispositionBreakdown,
        dailyTrends,
        topAgents: topAgents as any,
        activityStats,
        dataTeamStats: dataTeamStats as any,
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
