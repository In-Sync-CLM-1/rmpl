import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AllocationWithDetails {
  id: string;
  inventory_item_id: string;
  user_id: string;
  allocation_date: string;
  allocated_condition: string;
  expected_return_date: string | null;
  allocation_notes: string | null;
  allocated_by: string | null;
  deallocation_date: string | null;
  returned_condition: string | null;
  return_notes: string | null;
  deallocated_by: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  inventory_item?: {
    id: string;
    items: string;
    brand: string | null;
    model: string | null;
    serial_number: string | null;
    imei: string | null;
  };
  user?: {
    id: string;
    full_name: string | null;
    email: string | null;
  };
  allocated_by_profile?: {
    full_name: string | null;
  };
}

export function useInventoryAllocations(status?: 'active' | 'returned') {
  return useQuery({
    queryKey: ["inventory-allocations", status],
    staleTime: 3 * 60 * 1000, // 3 minutes
    queryFn: async () => {
      let query = supabase
        .from("inventory_allocations")
        .select(`
          *,
          inventory_item:inventory_items!inventory_allocations_inventory_item_id_fkey(
            id, items, brand, model, serial_number, imei
          ),
          user:profiles!inventory_allocations_user_id_fkey(
            id, full_name, email
          ),
          allocated_by_profile:profiles!inventory_allocations_allocated_by_fkey(
            full_name
          )
        `)
        .order("allocation_date", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as AllocationWithDetails[];
    },
  });
}

export function useAllocateInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      inventory_item_id: string;
      user_id: string;
      allocated_condition: string;
      allocation_date: string;
      expected_return_date?: string;
      allocation_notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("inventory_allocations")
        .insert({
          ...data,
          allocated_by: user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-stats"] });
      toast.success("Item allocated successfully");
    },
    onError: (error: Error) => {
      console.error("Inventory allocation error:", error);
      toast.error("Failed to allocate item: " + error.message);
    },
  });
}

export function useDeallocateInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      allocation_id: string;
      deallocation_date: string;
      returned_condition: string;
      return_notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("inventory_allocations")
        .update({
          status: "returned",
          deallocation_date: data.deallocation_date,
          returned_condition: data.returned_condition,
          return_notes: data.return_notes,
          deallocated_by: user.id,
        })
        .eq("id", data.allocation_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-stats"] });
      toast.success("Item returned successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to process return: " + error.message);
    },
  });
}
