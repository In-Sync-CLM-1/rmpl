import { useState, useMemo, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDemandComDashboard } from "@/hooks/useDemandComDashboard";
import { useAgentCallingReport } from "@/hooks/useAgentCallingReport";
import { useTeamFilter } from "@/hooks/useTeamFilter";
import { DemandComKPICards } from "@/components/demandcom-dashboard/DemandComKPICards";
import { AgentCallingReport } from "@/components/demandcom-dashboard/AgentCallingReport";
import { ActivityReportTable } from "@/components/demandcom-dashboard/ActivityReportTable";
import { DemandComInsightsPanel } from "@/components/demandcom-dashboard/DemandComInsightsPanel";
import { DailyTargetAchievement } from "@/components/demandcom-dashboard/DailyTargetAchievement";
import { CompactDateRangeFilter } from "@/components/filters/CompactDateRangeFilter";
import { format, isSameDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Users } from "lucide-react";

export default function DemandComDashboard() {
  const today = new Date();
  const [startDate, setStartDate] = useState<Date>(today);
  const [endDate, setEndDate] = useState<Date>(today);
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");

  // Team filter hook
  const { data: teamFilterData, isLoading: isTeamFilterLoading } = useTeamFilter();

  // Auto-select team for team leads (non-admins with subordinates)
  useEffect(() => {
    if (teamFilterData && teamFilterData.isTeamLead && !teamFilterData.isAdmin && teamFilterData.teamLeaders.length > 0) {
      setTeamFilter(teamFilterData.teamLeaders[0].id);
    }
  }, [teamFilterData]);

  // Compute team member IDs based on selected team filter
  const teamMemberIds = useMemo(() => {
    if (!teamFilterData || teamFilter === "all") return undefined;
    const selectedTeam = teamFilterData.teamLeaders.find(tl => tl.id === teamFilter);
    return selectedTeam?.teamMemberIds;
  }, [teamFilter, teamFilterData]);

  // Use selected date range for the dashboard
  const { data: metrics, isLoading } = useDemandComDashboard({
    startDate,
    endDate,
    agentFilter: agentFilter === "all" ? undefined : agentFilter,
    teamMemberIds,
  });
  // Use agent calling report to derive Connected Calls (ensures KPI matches Agent Performance total)
  const { data: agentReportData } = useAgentCallingReport({
    startDate,
    endDate,
    teamMemberIds,
  });

  const agentReportTotalCalls = useMemo(() => {
    if (!agentReportData) return undefined;
    return agentReportData.reduce((sum, agent) => sum + agent.totalCalls, 0);
  }, [agentReportData]);

  // Fetch agents for filter (all Demandcom-Calling team agents with 'agent' role)
  const { data: agents } = useQuery({
    queryKey: ['demandcom-agents'],
    queryFn: async () => {
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('user_id, teams!inner(name)')
        .eq('teams.name', 'Demandcom-Calling');
      
      if (!teamMembers || teamMembers.length === 0) return [];
      
      const teamMemberIds = teamMembers.map(tm => tm.user_id);
      
      const { data: agentRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'agent')
        .in('user_id', teamMemberIds);
      
      if (!agentRoles || agentRoles.length === 0) return [];
      
      const agentIds = agentRoles.map(a => a.user_id);
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', agentIds);
      
      return (profiles || []).map((p: any) => ({
        id: p.id,
        name: p.full_name || 'Unknown',
      }));
    },
  });

  // Fetch today's daily targets for the team
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { data: dailyTargets } = useQuery({
    queryKey: ['demandcom-daily-targets-totals', todayStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demandcom_daily_targets')
        .select('call_target, registration_target, campaign_type')
        .eq('target_date', todayStr);
      
      if (error) throw error;
      
      // Sum up targets by campaign type
      const totals = (data || []).reduce(
        (acc, t) => {
          if (t.campaign_type === 'online') {
            acc.onlineCallTarget += t.call_target || 0;
            acc.onlineRegTarget += t.registration_target || 0;
          } else if (t.campaign_type === 'offline') {
            acc.offlineCallTarget += t.call_target || 0;
            acc.offlineRegTarget += t.registration_target || 0;
          }
          return acc;
        },
        { onlineCallTarget: 0, onlineRegTarget: 0, offlineCallTarget: 0, offlineRegTarget: 0 }
      );
      
      return totals;
    },
  });

  // Format date range for display
  const getDateRangeLabel = () => {
    if (isSameDay(startDate, endDate)) {
      if (isSameDay(startDate, today)) {
        return "Today";
      }
      return format(startDate, "MMM d");
    }
    return `${format(startDate, "MMM d")} - ${format(endDate, "MMM d")}`;
  };

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col overflow-hidden p-4 gap-3">
        <Skeleton className="h-10 w-64 flex-shrink-0" />
        <div className="grid grid-cols-4 gap-3 flex-shrink-0">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="flex-1" />
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="h-screen flex flex-col overflow-hidden p-4 gap-3">
      {/* Compact Header with Filters */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold leading-tight">DemandCom Dashboard</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Date Range Filter */}
          <CompactDateRangeFilter
            from={startDate}
            to={endDate}
            onChange={(from, to) => {
              setStartDate(from || today);
              setEndDate(to || today);
            }}
          />
          {/* Team Filter - only show for admins and team leads */}
          {teamFilterData && (teamFilterData.isAdmin || teamFilterData.isTeamLead) && teamFilterData.teamLeaders.length > 0 && (
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <Users className="mr-1 h-3 w-3" />
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                {teamFilterData.isAdmin && <SelectItem value="all">All Teams</SelectItem>}
                {teamFilterData.teamLeaders.map(tl => (
                  <SelectItem key={tl.id} value={tl.id}>
                    {tl.name} ({tl.teamSize})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="All Agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agents?.map(agent => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Top Section: KPIs + Daily Targets + AI Insights */}
      <div className="flex gap-3 flex-shrink-0">
        <div className="flex-1">
          <DemandComKPICards metrics={{
            ...metrics,
            connectedCallsToday: agentReportTotalCalls ?? metrics.connectedCallsToday,
          }} dateLabel={getDateRangeLabel()} compact />
        </div>
        <div className="w-56">
          <DailyTargetAchievement 
            targets={dailyTargets || null}
            actuals={{
              totalCalls: agentReportTotalCalls ?? metrics.connectedCallsToday,
              registrations: metrics.registered,
            }}
            dateLabel={getDateRangeLabel()}
            compact
          />
        </div>
        <div className="w-72">
          <DemandComInsightsPanel metrics={metrics} compact />
        </div>
      </div>

      {/* Main Section: Activity on Left, Tabs on Right */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Activity Section - Left (constant across tabs) */}
        <div className="w-[35%] overflow-hidden flex flex-col">
          <ActivityReportTable data={metrics.activityStats} compact />
        </div>

        {/* Agent Performance - Right */}
        <div className="flex-1 flex flex-col min-h-0">
          <AgentCallingReport startDate={startDate} endDate={endDate} teamMemberIds={teamMemberIds} compact />
        </div>
      </div>
    </div>
  );
}
