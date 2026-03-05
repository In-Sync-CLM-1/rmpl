import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useOperationsInventoryDashboard() {
  const staleTime = 3 * 60 * 1000; // 3 minutes for dashboard data

  const { data: inventoryStats, isLoading: statsLoading } = useQuery({
    queryKey: ["operations-inventory-stats"],
    staleTime,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("category", "Operations");

      if (error) throw error;

      const total = data.length;
      const totalValue = data.reduce((sum, item) => sum + (item.total_cost || 0), 0);
      const available = data.filter(item => item.status === "Available").length;
      const allocated = data.filter(item => item.status === "Allocated").length;
      const damaged = data.filter(item => item.status === "Damaged").length;
      const retired = data.filter(item => item.status === "Retired").length;

      return {
        total,
        totalValue,
        available,
        allocated,
        damaged,
        retired,
        items: data,
      };
    },
  });

  const { data: distributionStats, isLoading: distributionLoading } = useQuery({
    queryKey: ["operations-distribution-stats"],
    staleTime,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operations_inventory_distribution")
        .select(`
          *,
          inventory_items (items, brand, model, rate)
        `);

      if (error) throw error;

      // Location-wise distribution
      const locationMap = new Map();
      data.forEach(item => {
        const loc = item.location || "Unknown";
        if (!locationMap.has(loc)) {
          locationMap.set(loc, { location: loc, count: 0, quantity: 0 });
        }
        const current = locationMap.get(loc);
        current.count++;
        current.quantity += item.quantity_dispatched;
      });

      // Usage statistics
      const totalDispatched = data.reduce((sum, d) => sum + d.quantity_dispatched, 0);
      const totalUsage = data.reduce((sum, d) => sum + (d.usage_count || 0), 0);
      const totalDamaged = data.reduce((sum, d) => sum + (d.damaged_lost_count || 0), 0);
      const totalBalance = data.reduce((sum, d) => 
        sum + (d.quantity_dispatched - (d.usage_count || 0) - (d.damaged_lost_count || 0)), 0
      );

      // Type-wise distribution
      const typeMap = new Map();
      data.forEach(item => {
        const type = item.distribution_type;
        if (!typeMap.has(type)) {
          typeMap.set(type, { type, count: 0 });
        }
        typeMap.get(type).count++;
      });

      return {
        totalDispatched,
        totalUsage,
        totalDamaged,
        totalBalance,
        locationData: Array.from(locationMap.values()),
        typeData: Array.from(typeMap.values()),
        recentDistributions: data.slice(0, 10),
      };
    },
  });

  const { data: valueByItem, isLoading: valueLoading } = useQuery({
    queryKey: ["operations-inventory-value-by-item"],
    staleTime,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("items, total_cost, quantity, status")
        .eq("category", "Operations")
        .order("total_cost", { ascending: false })
        .order("total_cost", { ascending: false })
        .limit(10);

      if (error) throw error;

      return data.map(item => ({
        name: item.items,
        value: item.total_cost || 0,
        quantity: item.quantity,
        status: item.status,
      }));
    },
  });

  return {
    inventoryStats,
    distributionStats,
    valueByItem,
    isLoading: statsLoading || distributionLoading || valueLoading,
  };
}
