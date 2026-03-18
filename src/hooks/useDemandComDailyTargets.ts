import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { startOfDay, endOfDay } from "date-fns";

export interface DailyTarget {
  id: string;
  target_date: string;
  user_id: string;
  set_by: string | null;
  call_target: number;
  registration_target: number;
  database_update_target: number;
  campaign_type: string;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyAchievement {
  actualCalls: number;
  actualRegistrations: number;
  actualDatabaseUpdates: number;
}

export interface TeamMemberWithTarget {
  id: string;
  full_name: string;
  email: string;
  reports_to: string | null;
  callTarget: number;
  regTarget: number;
  dbUpdateTarget: number;
  achievement?: DailyAchievement;
  hasAttendance?: boolean;
}

export interface TeamLeaderWithAgents {
  teamLeader: TeamMemberWithTarget;
  agents: TeamMemberWithTarget[];
}

// Demandcom Calling Team ID
const DEMANDCOM_CALLING_TEAM_ID = '7f2cbe71-d83a-483e-9127-0cb3176cf957';

// Note: 'manager' role is excluded because team leads often have this role but should only see their own team
const ADMIN_ROLES = ['platform_admin', 'super_admin', 'admin_administration', 'admin_tech', 'admin'];

export const useDemandComDailyTargets = (targetDate: string) => {
  const queryClient = useQueryClient();

  // Fetch team hierarchy dynamically (Team Leaders and their agents)
  // Get current user ID for cache key
  const { data: currentUser } = useQuery({
    queryKey: ['current-user-for-hierarchy'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: teamData, isLoading: isLoadingTeam } = useQuery({
    queryKey: ['demandcom-team-hierarchy', currentUser],
    queryFn: async () => {
      console.log('=== DemandCom Daily Targets Debug ===');
      
      if (!currentUser) {
        console.log('No currentUser, returning empty');
        return { hierarchy: [], teamLeaderIds: [], isAdmin: false };
      }
      
      // Get current user first
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current user ID:', user?.id);
      
      if (!user) {
        console.log('No user from auth, returning empty');
        return { hierarchy: [], teamLeaderIds: [], isAdmin: false };
      }

      // Check if current user is admin/manager
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const roles = userRoles?.map(r => r.role) || [];
      const isAdmin = roles.some(r => ADMIN_ROLES.includes(r));
      const isManager = roles.includes('manager');
      const isLeadership = roles.includes('leadership');
      console.log('User roles:', roles);
      console.log('Is Admin:', isAdmin, 'Is Manager:', isManager, 'Is Leadership:', isLeadership);

      // Step 1: Get all active members of Demandcom-Calling team
      const { data: teamMembers, error: tmError } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', DEMANDCOM_CALLING_TEAM_ID)
        .eq('is_active', true);

      if (tmError) throw tmError;
      
      const memberIds = teamMembers?.map(m => m.user_id) || [];
      console.log('Team members count:', memberIds.length);
      
      if (memberIds.length === 0) {
        console.log('No team members found, returning empty');
        return { hierarchy: [], teamLeaderIds: [], isAdmin };
      }

      // Step 2: Get profiles with reports_to for these members
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, reports_to')
        .in('id', memberIds);

      if (profilesError) throw profilesError;
      
      console.log('Profiles fetched:', profiles?.length);

      // Step 3: Identify Team Leaders = members who report to Vibhor (the manager)
      const VIBHOR_ID = 'e0261662-aff9-4e08-8ede-0aadad826d4d';
      const memberIdSet = new Set(memberIds);
      
      const profilesReportingToVibhor = (profiles || []).filter(p => p.reports_to === VIBHOR_ID);
      console.log('Profiles reporting to VIBHOR_ID:', profilesReportingToVibhor.map(p => ({ id: p.id, name: p.full_name })));
      
      const allTeamLeaderIds = profilesReportingToVibhor
        .filter(p => memberIdSet.has(p.id))
        .map(p => p.id);
      
      console.log('All Team Leader IDs:', allTeamLeaderIds);
      console.log('Is current user a TL?', allTeamLeaderIds.includes(user.id));

      // Step 4: Filter based on user role
      // Check TL first so TLs with 'manager' role only see their own team
      let filteredTeamLeaderIds: string[];

      if (allTeamLeaderIds.includes(user.id)) {
        filteredTeamLeaderIds = [user.id];
        console.log('TL mode: showing only self');
      } else if (isAdmin || isManager || isLeadership) {
        filteredTeamLeaderIds = allTeamLeaderIds;
        console.log('Admin/Manager/Leadership mode: showing all TLs');
      } else {
        console.log('Regular agent: no hierarchy view');
        return { hierarchy: [], teamLeaderIds: [], isAdmin };
      }
      
      console.log('Filtered Team Leader IDs:', filteredTeamLeaderIds);

      // Step 5: Build hierarchy with filtered team leaders and their agents
      const teamLeaders = (profiles || []).filter(p => filteredTeamLeaderIds.includes(p.id));
      const agents = (profiles || []).filter(p => p.reports_to && filteredTeamLeaderIds.includes(p.reports_to));
      
      console.log('Team Leaders found:', teamLeaders.map(tl => ({ id: tl.id, name: tl.full_name })));
      console.log('Agents found:', agents.map(a => ({ id: a.id, name: a.full_name, reportsTo: a.reports_to })));

      const hierarchy = teamLeaders
        .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
        .map(tl => ({
          teamLeader: { ...tl, callTarget: 0, regTarget: 0, dbUpdateTarget: 0 } as TeamMemberWithTarget,
          agents: agents
            .filter(agent => agent.reports_to === tl.id)
            .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
            .map(a => ({ ...a, callTarget: 0, regTarget: 0, dbUpdateTarget: 0 })) as TeamMemberWithTarget[],
        }));

      console.log('Final hierarchy:', hierarchy.map(h => ({
        leader: h.teamLeader.full_name,
        agentCount: h.agents.length,
        agents: h.agents.map(a => a.full_name)
      })));
      console.log('=== End Debug ===');

      return { hierarchy, teamLeaderIds: filteredTeamLeaderIds, isAdmin };
    },
    enabled: !!currentUser,
  });

  const teamHierarchy = teamData?.hierarchy;
  const teamLeaderIds = teamData?.teamLeaderIds || [];

  // Fetch attendance records for the selected date
  const { data: attendanceRecords } = useQuery({
    queryKey: ['demandcom-attendance', targetDate],
    queryFn: async () => {
      const allMemberIds = teamHierarchy?.flatMap(team => [
        team.teamLeader.id,
        ...team.agents.map(a => a.id)
      ]) || [];
      
      if (allMemberIds.length === 0) return new Set<string>();

      const { data, error } = await supabase
        .from('attendance_records')
        .select('user_id')
        .eq('date', targetDate)
        .in('user_id', allMemberIds)
        .not('sign_in_time', 'is', null);

      if (error) throw error;
      return new Set(data?.map(r => r.user_id) || []);
    },
    enabled: !!targetDate && !!teamHierarchy,
  });

  // Fetch all targets for the selected date (combined - using 'combined' campaign type)
  const { data: targets, isLoading: isLoadingTargets } = useQuery({
    queryKey: ['demandcom-daily-targets', targetDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demandcom_daily_targets')
        .select('*')
        .eq('target_date', targetDate);

      if (error) throw error;
      return data as DailyTarget[];
    },
    enabled: !!targetDate,
  });

  // Fetch achievements (actual calls and registrations) for the selected date
  const { data: achievements, isLoading: isLoadingAchievements } = useQuery({
    queryKey: ['demandcom-daily-achievements', targetDate],
    queryFn: async () => {
      const allAgentIds = teamHierarchy?.flatMap(team => team.agents.map(a => a.id)) || [];
      if (allAgentIds.length === 0) return new Map<string, DailyAchievement>();

      const dateStart = startOfDay(new Date(targetDate));
      const dateEnd = endOfDay(new Date(targetDate));

      // Get disposition changes (calls) for the date
      const { data: dispositionChanges } = await supabase
        .from('demandcom_field_changes')
        .select('changed_by, demandcom_id, new_value')
        .eq('field_name', 'disposition')
        .in('changed_by', allAgentIds)
        .gte('changed_at', dateStart.toISOString())
        .lte('changed_at', dateEnd.toISOString());

      const callsMap = new Map<string, number>();
      for (const change of dispositionChanges || []) {
        if (change.changed_by) {
          callsMap.set(change.changed_by, (callsMap.get(change.changed_by) || 0) + 1);
        }
      }

      // Get registrations - Connected dispositions (1, 2, 3, 4)
      const { data: agentConvertedChanges } = await supabase
        .from('demandcom_field_changes')
        .select('changed_by, demandcom_id')
        .eq('field_name', 'disposition')
        .in('new_value', ['Connected', 'Connected 1', 'Connected 2', 'Connected 3', 'Connected 4'])
        .in('changed_by', allAgentIds)
        .gte('changed_at', dateStart.toISOString())
        .lte('changed_at', dateEnd.toISOString());

      const agentConvertedDemandcomIds = [...new Set(agentConvertedChanges?.map(c => c.demandcom_id).filter(Boolean) || [])];
      
      const registrationsMap = new Map<string, number>();
      
      if (agentConvertedDemandcomIds.length > 0) {
        const { data: registeredDemandcom } = await supabase
          .from('demandcom')
          .select('id, latest_subdisposition')
          .in('id', agentConvertedDemandcomIds)
          .eq('latest_subdisposition', 'Registered');
        
        const validDemandcomIds = new Set(registeredDemandcom?.map(d => d.id) || []);
        
        for (const change of agentConvertedChanges || []) {
          if (change.demandcom_id && validDemandcomIds.has(change.demandcom_id) && change.changed_by) {
            registrationsMap.set(change.changed_by, (registrationsMap.get(change.changed_by) || 0) + 1);
          }
        }
      }

      // Bulk registrations - find records created on target date that are registered
      // but were NOT converted by an agent (i.e., bulk imports)
      const { data: bulkRegistrations } = await supabase
        .from('demandcom')
        .select('id, assigned_to')
        .eq('latest_subdisposition', 'Registered')
        .in('assigned_to', allAgentIds)
        .gte('created_at', dateStart.toISOString())
        .lte('created_at', dateEnd.toISOString());

      // Exclude records that were already counted via agent disposition changes
      const agentConvertedDemandcomIdsSet = new Set(agentConvertedDemandcomIds);

      for (const reg of bulkRegistrations || []) {
        if (agentConvertedDemandcomIdsSet.has(reg.id)) continue;
        if (reg.assigned_to) {
          registrationsMap.set(reg.assigned_to, (registrationsMap.get(reg.assigned_to) || 0) + 1);
        }
      }

      // Get database updates - disposition changed to 'Partially Validate' or 'Fully Validate'
      const { data: dbUpdateChanges } = await supabase
        .from('demandcom_field_changes')
        .select('changed_by, demandcom_id')
        .eq('field_name', 'disposition')
        .in('new_value', ['Partially Validate', 'Fully Validate'])
        .in('changed_by', allAgentIds)
        .gte('changed_at', dateStart.toISOString())
        .lte('changed_at', dateEnd.toISOString());

      const dbUpdatesMap = new Map<string, number>();
      for (const change of dbUpdateChanges || []) {
        if (change.changed_by) {
          dbUpdatesMap.set(change.changed_by, (dbUpdatesMap.get(change.changed_by) || 0) + 1);
        }
      }

      const achievementsMap = new Map<string, DailyAchievement>();
      for (const agentId of allAgentIds) {
        achievementsMap.set(agentId, {
          actualCalls: callsMap.get(agentId) || 0,
          actualRegistrations: registrationsMap.get(agentId) || 0,
          actualDatabaseUpdates: dbUpdatesMap.get(agentId) || 0,
        });
      }

      return achievementsMap;
    },
    enabled: !!targetDate && !!teamHierarchy,
  });

  // Combine online + offline targets into single values per user
  const getCombinedTarget = (userId: string) => {
    const userTargets = targets?.filter(t => t.user_id === userId) || [];
    const callTarget = userTargets.reduce((sum, t) => sum + (t.call_target || 0), 0);
    const regTarget = userTargets.reduce((sum, t) => sum + (t.registration_target || 0), 0);
    const dbUpdateTarget = userTargets.reduce((sum, t) => sum + ((t as any).database_update_target || 0), 0);
    return { callTarget, regTarget, dbUpdateTarget };
  };

  // Merge targets, achievements, and attendance with team hierarchy
  const teamWithTargets: TeamLeaderWithAgents[] | undefined = teamHierarchy?.map(team => {
    const leaderTarget = getCombinedTarget(team.teamLeader.id);
    return {
      teamLeader: {
        ...team.teamLeader,
        callTarget: leaderTarget.callTarget,
        regTarget: leaderTarget.regTarget,
        dbUpdateTarget: leaderTarget.dbUpdateTarget,
        hasAttendance: attendanceRecords?.has(team.teamLeader.id) || false,
      },
      agents: team.agents.map(agent => {
        const agentTarget = getCombinedTarget(agent.id);
        return {
          ...agent,
          callTarget: agentTarget.callTarget,
          regTarget: agentTarget.regTarget,
          dbUpdateTarget: agentTarget.dbUpdateTarget,
          achievement: achievements?.get(agent.id),
          hasAttendance: attendanceRecords?.has(agent.id) || false,
        };
      }),
    };
  });

  // Mutation for upserting targets (using 'combined' as campaign_type)
  const upsertTargetMutation = useMutation({
    mutationFn: async ({
      userId,
      callTarget,
      registrationTarget,
      databaseUpdateTarget,
    }: {
      userId: string;
      callTarget: number;
      registrationTarget: number;
      databaseUpdateTarget: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('demandcom_daily_targets')
        .upsert(
          {
            target_date: targetDate,
            user_id: userId,
            campaign_type: 'combined',
            call_target: callTarget,
            registration_target: registrationTarget,
            database_update_target: databaseUpdateTarget,
            set_by: user.id,
          } as any,
          {
            onConflict: 'target_date,user_id,campaign_type',
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandcom-daily-targets', targetDate] });
      toast.success('Target saved');
    },
    onError: (error: Error) => {
      console.error('Error saving target:', error);
      toast.error('Failed to save target');
    },
  });

  // Calculate totals
  const totals = teamWithTargets?.reduce(
    (acc, team) => {
      team.agents.forEach(agent => {
        acc.callTarget += agent.callTarget;
        acc.regTarget += agent.regTarget;
        acc.dbUpdateTarget += agent.dbUpdateTarget;
        acc.actualCalls += agent.achievement?.actualCalls || 0;
        acc.actualRegistrations += agent.achievement?.actualRegistrations || 0;
        acc.actualDatabaseUpdates += agent.achievement?.actualDatabaseUpdates || 0;
      });
      return acc;
    },
    { callTarget: 0, regTarget: 0, dbUpdateTarget: 0, actualCalls: 0, actualRegistrations: 0, actualDatabaseUpdates: 0 }
  );

  return {
    teamWithTargets,
    teamLeaderIds,
    totals,
    isLoading: isLoadingTeam || isLoadingTargets || isLoadingAchievements,
    upsertTarget: upsertTargetMutation.mutate,
    isUpdating: upsertTargetMutation.isPending,
  };
};
