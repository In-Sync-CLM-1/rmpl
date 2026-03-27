import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export const useDemandComDailyTargets = (targetDate: string) => {
  const queryClient = useQueryClient();

  // Single RPC call replaces 12+ queries
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['demandcom-daily-targets-dashboard', targetDate],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { hierarchy: [], teamLeaderIds: [], isAdmin: false };

      const { data, error } = await supabase.rpc('get_daily_targets_dashboard', {
        p_user_id: user.id,
        p_target_date: targetDate,
      });

      if (error) throw new Error(`Daily targets RPC failed: ${error.message}`);

      const result = data as any;
      return {
        hierarchy: (result?.hierarchy || []) as TeamLeaderWithAgents[],
        teamLeaderIds: (result?.teamLeaderIds || []) as string[],
        isAdmin: result?.isAdmin || false,
      };
    },
    enabled: !!targetDate,
    staleTime: 30000,
  });

  const teamWithTargets = dashboardData?.hierarchy;
  const teamLeaderIds = dashboardData?.teamLeaderIds || [];

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
      queryClient.invalidateQueries({ queryKey: ['demandcom-daily-targets-dashboard', targetDate] });
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
    isLoading,
    upsertTarget: upsertTargetMutation.mutate,
    isUpdating: upsertTargetMutation.isPending,
  };
};
