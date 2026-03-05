import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InventoryStats {
  total_inventory: number;
  available_count: number;
  allocated_count: number;
  damaged_count: number;
  retired_count: number;
}

export function useInventoryStats() {
  return useQuery({
    queryKey: ["inventory-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_summary_stats")
        .select("*")
        .single();

      if (error) throw error;
      return data as InventoryStats;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
