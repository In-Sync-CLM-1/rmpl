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

export interface CSBDProjectCredit {
  project_number: string;
  client_name: string;
  executed_by: string;
  status: string;
  effective_date: string;
  date_source: string;
  amount_lacs: number;
  credit_pct: number;
  credit_amount: number;
  rule_applied: string;
}

export const useCSBDMemberProjects = (userId: string | null, fiscalYear = 2026) => {
  return useQuery({
    queryKey: ['csbd-member-projects', userId, fiscalYear],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.rpc('get_csbd_member_projects', {
        p_user_id: userId,
        p_fiscal_year: fiscalYear,
      });
      if (error) throw new Error(`Failed to load projects: ${error.message}`);
      return (data as CSBDProjectCredit[]) || [];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useAllCSBDMetrics = (fiscalYear = 2025) => {
  return useQuery({
    queryKey: ['all-csbd-metrics', fiscalYear],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_csbd_dashboard', {
        p_fiscal_year: fiscalYear,
      });

      if (error) throw new Error(`Failed to load dashboard: ${error.message}`);
      return (data as CSBDMetrics[]) || [];
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
};
