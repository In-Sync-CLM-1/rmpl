import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DigiComChecklistItem {
  id: string;
  project_id: string;
  checklist_item: string;
  assigned_to: string | null;
  due_date: string | null;
  status: "pending" | "in_progress" | "completed";
  description: string | null;
  created_at: string;
  updated_at: string;
  assigned_user?: {
    id: string;
    full_name: string | null;
  };
}

const PREDEFINED_CHECKLIST_ITEMS = [
  "Content - Concept and Theme",
  "Content - eDM",
  "Content - Thank You mail",
  "Content - Social Media post",
  "Content - Video script",
  "3D Design - Stage",
  "3D Design - Registration",
  "3D Design - Photo Booth",
  "Graphic - Side panel",
  "Graphic - Standee",
  "Graphic - Agenda",
  "Video - Event opening video",
  "Video - Teaser",
  "Video - Post event",
  "Video - Speaker citation",
  "Video - Award citation",
];

export function useProjectDigiCom(projectId: string) {
  const queryClient = useQueryClient();

  // Fetch checklist items
  const { data: checklistItems = [], isLoading } = useQuery({
    queryKey: ["project-digicom", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_checklists")
        .select(
          `
          *,
          assigned_user:profiles!project_checklists_assigned_to_fkey(
            id,
            full_name
          )
        `
        )
        .eq("project_id", projectId)
        .eq("checklist_type", "digicom")
        .order("checklist_item");

      if (error) throw error;
      return data as DigiComChecklistItem[];
    },
    enabled: !!projectId && projectId !== "new",
  });

  // Initialize checklist with all predefined items if none exist
  const initializeChecklist = useMutation({
    mutationFn: async () => {
      // Check if any items already exist
      const { data: existing } = await supabase
        .from("project_checklists")
        .select("id")
        .eq("project_id", projectId)
        .eq("checklist_type", "digicom")
        .limit(1);

      if (existing && existing.length > 0) {
        return; // Checklist already initialized
      }

      // Insert all predefined items
      const items = PREDEFINED_CHECKLIST_ITEMS.map((item) => ({
        project_id: projectId,
        checklist_type: "digicom" as const,
        checklist_item: item,
        status: "pending" as const,
      }));

      const { error } = await supabase
        .from("project_checklists")
        .insert(items);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-digicom", projectId] });
    },
    onError: (error: Error) => {
      console.error("Error initializing checklist:", error);
      toast.error("Failed to initialize DigiCom checklist");
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
        .from("project_checklists")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-digicom", projectId] });
      toast.success("Checklist item updated");
    },
    onError: (error: Error) => {
      console.error("Error updating checklist item:", error);
      toast.error("Failed to update checklist item");
    },
  });

  return {
    checklistItems,
    isLoading,
    initializeChecklist: initializeChecklist.mutateAsync,
    isInitializing: initializeChecklist.isPending,
    updateChecklistItem: updateChecklistItem.mutateAsync,
    isUpdating: updateChecklistItem.isPending,
  };
}
