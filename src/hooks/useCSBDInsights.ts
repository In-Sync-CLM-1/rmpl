import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CSBDMetrics } from "./useCSBDMetrics";

export const useCSBDInsights = (metrics: CSBDMetrics[] | undefined, fiscalYear: number) => {
  return useQuery({
    queryKey: ['csbd-insights', fiscalYear, metrics?.length],
    queryFn: async () => {
      if (!metrics || metrics.length === 0) {
        throw new Error('No metrics available');
      }

      const { data, error } = await supabase.functions.invoke('generate-csbd-insights', {
        body: { metrics, fiscalYear },
      });

      if (error) throw error;
      return data.insights as string;
    },
    enabled: !!metrics && metrics.length > 0,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });
};
