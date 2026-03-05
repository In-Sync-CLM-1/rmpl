import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DemandComChecklistItem {
  id: string;
  project_id: string;
  checklist_item: string;
  description: string | null;
  assigned_to: string | null;
  due_date: string | null;
  status: "pending" | "in_progress" | "completed";
  created_at: string;
  updated_at: string;
  assigned_user?: {
    id: string;
    full_name: string | null;
  };
}

const PREDEFINED_CHECKLIST_ITEMS = [
  "Database - Industry segment",
  "Database - Turnover",
  "Database - Geography/Location",
  "Database - Employee size",
  "Database - Special Request",
  "Database - Target persona",
  "Telecalling - Registration Target",
  "Telecalling - Attendee Target",
  "Profiling - Industry segment",
  "Profiling - Turnover",
  "Profiling - Geography/Location",
  "Profiling - Employee size",
  "Profiling - Special Request",
  "Profiling - Target persona",
  "MQL - Target",
];

export function useProjectDemandCom(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: checklistItems, isLoading } = useQuery({
    queryKey: ["project-demandcom-checklist", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from("project_demandcom_checklist")
        .select(`
          *,
          assigned_user:profiles!project_demandcom_checklist_assigned_to_fkey(
            id,
            full_name
          )
        `)
        .eq("project_id", projectId)
        .order("checklist_item");

      if (error) throw error;
      return (data || []) as DemandComChecklistItem[];
    },
    enabled: !!projectId,
  });

  const initializeChecklist = useMutation({
    mutationFn: async (projectId: string) => {
      const itemsToInsert = PREDEFINED_CHECKLIST_ITEMS.map((item) => ({
        project_id: projectId,
        checklist_item: item,
        status: "pending" as const,
      }));

      const { error } = await supabase
        .from("project_demandcom_checklist")
        .insert(itemsToInsert);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-demandcom-checklist", projectId],
      });
      toast.success("DemandCom checklist initialized");
    },
    onError: (error) => {
      console.error("Error initializing checklist:", error);
      toast.error("Failed to initialize DemandCom checklist");
    },
  });

  const updateChecklistItem = useMutation({
    mutationFn: async ({
      itemId,
      data,
    }: {
      itemId: string;
      data: {
        assigned_to?: string | null;
        due_date?: string | null;
        status?: "pending" | "in_progress" | "completed";
        description?: string | null;
      };
    }) => {
      const { error } = await supabase
        .from("project_demandcom_checklist")
        .update(data)
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-demandcom-checklist", projectId],
      });
      toast.success("Checklist item updated");
    },
    onError: (error) => {
      console.error("Error updating checklist item:", error);
      toast.error("Failed to update checklist item");
    },
  });

  return {
    checklistItems: checklistItems || [],
    isLoading,
    isInitializing: initializeChecklist.isPending,
    isUpdating: updateChecklistItem.isPending,
    initializeChecklist: initializeChecklist.mutate,
    updateChecklistItem: updateChecklistItem.mutate,
  };
}
