import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface LiveComChecklistItem {
  id: string;
  project_id: string;
  checklist_item: string;
  assigned_to: string | null;
  assigned_user?: {
    id: string;
    full_name: string;
  };
  due_date: string | null;
  status: "pending" | "in_progress" | "completed";
  description: string | null;
  created_at: string;
  updated_at: string;
}

const PREDEFINED_CHECKLIST_ITEMS = [
  "Hotel - Venue Selection",
  "Hotel - Recee",
  "Hotel - Contract",
  "Hotel - Room",
  "SetUp - Brief",
  "SetUp - Vendor Identification",
  "SetUp - Vendor Quote",
  "SetUp - Vendor Finalisation",
  "SetUp - Cost approval",
  "SetUp - PO to vendor",
  "SetUp - Production check",
  "SetUp - Site visit",
  "Design finalisation - Design finalisation",
  "Onsite - Setup timeline",
  "Onsite - Onsite team briefing",
  "Onsite - Showflow",
  "Onsite - Setup QC",
  "Onsite - Hotel billing closure",
  "Collateral - Align Vendor",
  "Collateral - Process work",
  "Collateral - Check Sample",
  "Collateral - Final approval",
  "Collateral - Process order",
  "Collateral - Quality Check /QC",
  "Post event - Vendor billing",
  "Post event - Vendor payment",
  "Post event - Handover of event pic and video",
];

export function useProjectLiveCom(projectId: string) {
  const queryClient = useQueryClient();

  // Fetch checklist items
  const { data: checklistItems = [], isLoading } = useQuery({
    queryKey: ["project-livecom", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_livecom_checklist")
        .select(
          `
          *,
          assigned_user:profiles!assigned_to (
            id,
            full_name
          )
        `
        )
        .eq("project_id", projectId)
        .order("checklist_item");

      if (error) throw error;
      return data as LiveComChecklistItem[];
    },
    enabled: !!projectId && projectId !== "new",
  });

  // Initialize checklist with predefined items
  const initializeChecklist = useMutation({
    mutationFn: async () => {
      const itemsToInsert = PREDEFINED_CHECKLIST_ITEMS.map((item) => ({
        project_id: projectId,
        checklist_item: item,
        status: "pending" as const,
      }));

      const { error } = await supabase
        .from("project_livecom_checklist")
        .insert(itemsToInsert);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-livecom", projectId],
      });
      toast({
        title: "Checklist initialized",
        description: "LiveCom checklist has been set up successfully.",
      });
    },
    onError: (error) => {
      console.error("Error initializing checklist:", error);
      toast({
        title: "Error",
        description: "Failed to initialize checklist.",
        variant: "destructive",
      });
    },
  });

  // Update checklist item
  const updateChecklistItem = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        assigned_to?: string | null;
        due_date?: string | null;
        status?: "pending" | "in_progress" | "completed";
        description?: string | null;
      };
    }) => {
      const { error } = await supabase
        .from("project_livecom_checklist")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-livecom", projectId],
      });
      toast({
        title: "Updated",
        description: "Checklist item has been updated successfully.",
      });
    },
    onError: (error) => {
      console.error("Error updating checklist item:", error);
      toast({
        title: "Error",
        description: "Failed to update checklist item.",
        variant: "destructive",
      });
    },
  });

  return {
    checklistItems,
    isLoading,
    initializeChecklist: initializeChecklist.mutate,
    isInitializing: initializeChecklist.isPending,
    updateChecklistItem: updateChecklistItem.mutateAsync,
    isUpdating: updateChecklistItem.isPending,
  };
}
