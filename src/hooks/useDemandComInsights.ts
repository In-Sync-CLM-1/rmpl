import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DemandComDashboardMetrics } from "./useDemandComDashboard";

export const useDemandComInsights = (metrics: DemandComDashboardMetrics | undefined) => {
  return useQuery({
    queryKey: ['demandcom-insights', metrics?.totalCount, metrics?.assignedCount],
    queryFn: async () => {
      if (!metrics) {
        throw new Error('No metrics available');
      }

      const { data, error } = await supabase.functions.invoke('generate-demandcom-insights', {
        body: { metrics },
      });

      if (error) throw error;
      return data.insights as string;
    },
    enabled: !!metrics && metrics.totalCount > 0,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });
};
