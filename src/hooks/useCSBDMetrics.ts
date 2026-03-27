import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MonthlyMetrics {
  month: string;
  projection: number;
  actual: number;
  variance: number;
  over_under_percentage: number;
}

export interface CSBDMetrics {
  user_id: string;
  full_name: string;
  email: string;
  annual_target: number;
  ytd_projection: number;
  ytd_actual: number;
  ytd_variance: number;
  achievement_percentage: number;
  projection_fulfilment_percentage: number;
  monthly_performance: MonthlyMetrics[];
  has_subordinates: boolean;
  team_metrics?: CSBDMetrics[];
}

export const useCSBDMetrics = (userId?: string, fiscalYear = 2025, includeTeam = false) => {
  return useQuery({
    queryKey: ['csbd-metrics', userId, fiscalYear, includeTeam],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('calculate-csbd-metrics', {
        body: {
          user_id: userId,
          fiscal_year: fiscalYear,
          include_team: includeTeam,
        },
      });

      if (error) throw error;
      return data as CSBDMetrics;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000,
  });
};

export const useAllCSBDMetrics = (fiscalYear = 2025) => {
  return useQuery({
    queryKey: ['all-csbd-metrics', fiscalYear],
    queryFn: async () => {
      // Get all CSBD team members with has_subordinates flag
      const { data: targets, error: targetsError } = await supabase
        .from('csbd_targets')
        .select('user_id, has_subordinates, profiles(full_name, email)')
        .eq('fiscal_year', fiscalYear)
        .eq('is_active', true);

      if (targetsError) throw new Error(`Failed to fetch targets: ${targetsError.message}`);
      if (!targets || targets.length === 0) return [];

      // Fetch metrics for each user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const allMetrics = await Promise.all(
        targets.map(async (target) => {
          const { data, error } = await supabase.functions.invoke('calculate-csbd-metrics', {
            body: {
              user_id: target.user_id,
              fiscal_year: fiscalYear,
              include_team: target.has_subordinates || false,
            },
          });
          if (error) {
            console.error(`CSBD metrics error for ${target.user_id}:`, error);
            return null;
          }
          return data as CSBDMetrics;
        })
      );

      return allMetrics.filter(Boolean);
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 3,
  });
};
