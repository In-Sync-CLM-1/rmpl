import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface OperationsDistribution {
  id: string;
  project_id: string | null;
  client_name: string | null;
  inventory_item_id: string;
  distribution_type: string;
  quantity_dispatched: number;
  despatch_date: string;
  despatched_to: string;
  location: string | null;
  dispatch_mode: string;
  awb_number: string | null;
  usage_count: number;
  damaged_lost_count: number;
  net_quantity: number;
  return_location: string | null;
  notes: string | null;
  images: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  inventory_items?: {
    items: string;
    brand: string | null;
    model: string | null;
  };
  projects?: {
    project_name: string;
    project_number: string;
  };
}

export interface DistributionFormData {
  project_id?: string;
  client_name?: string;
  inventory_item_id: string;
  distribution_type: string;
  quantity_dispatched: number;
  despatch_date: string;
  despatched_to: string;
  location?: string;
  dispatch_mode: string;
  awb_number?: string;
  usage_count?: number;
  damaged_lost_count?: number;
  return_location?: string;
  notes?: string;
  images?: string[];
}

export function useOperationsDistribution() {
  const queryClient = useQueryClient();

  const { data: distributions, isLoading } = useQuery({
    queryKey: ["operations-distribution"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operations_inventory_distribution")
        .select(`
          *,
          inventory_items (items, brand, model),
          projects (project_name, project_number)
        `)
        .order("despatch_date", { ascending: false });

      if (error) throw error;
      return data as OperationsDistribution[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (formData: DistributionFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("operations_inventory_distribution")
        .insert({
          ...formData,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations-distribution"] });
      toast.success("Distribution record created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create distribution: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: Partial<DistributionFormData> }) => {
      const { data, error } = await supabase
        .from("operations_inventory_distribution")
        .update(formData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations-distribution"] });
      toast.success("Distribution record updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update distribution: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("operations_inventory_distribution")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations-distribution"] });
      toast.success("Distribution record deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete distribution: ${error.message}`);
    },
  });

  return {
    distributions,
    isLoading,
    createDistribution: createMutation.mutateAsync,
    updateDistribution: updateMutation.mutateAsync,
    deleteDistribution: deleteMutation.mutateAsync,
  };
}
