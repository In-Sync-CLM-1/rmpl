import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface LiveComEvent {
  id: string;
  project_id: string;
  vendor_hotel_id: string | null;
  vendor_hotel?: {
    id: string;
    vendor_name: string;
  };
  services: string | null;
  internal_cost_exc_tax: number | null;
  rating_by_livecom: number | null;
  rating_by_csbd: number | null;
  remarks_by_livecom: string | null;
  remarks_by_csbd: string | null;
  created_at: string;
  updated_at: string;
}

export function useProjectLiveComEvents(projectId: string) {
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["project-livecom-events", projectId],
    staleTime: 2 * 60 * 1000, // 2 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_livecom_events")
        .select(`
          *,
          vendor_hotel:vendors!vendor_hotel_id (
            id,
            vendor_name
          )
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as LiveComEvent[];
    },
    enabled: !!projectId && projectId !== "new",
  });

  const createEvent = useMutation({
    mutationFn: async (eventData: Partial<LiveComEvent>) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("project_livecom_events")
        .insert({
          project_id: projectId,
          created_by: userData.user?.id,
          ...eventData,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-livecom-events", projectId],
      });
      toast({
        title: "Event added",
        description: "LiveCom event has been added successfully.",
      });
    },
    onError: (error) => {
      console.error("Error creating event:", error);
      toast({
        title: "Error",
        description: "Failed to add event.",
        variant: "destructive",
      });
    },
  });

  const updateEvent = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      // Filter out any undefined values to prevent sending invalid data
      const cleanData: Record<string, any> = {};
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          cleanData[key] = value;
        }
      });

      const { error } = await supabase
        .from("project_livecom_events")
        .update(cleanData)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-livecom-events", projectId],
      });
      toast({
        title: "Updated",
        description: "Event has been updated successfully.",
      });
    },
    onError: (error) => {
      console.error("Error updating event:", error);
      toast({
        title: "Error",
        description: "Failed to update event.",
        variant: "destructive",
      });
    },
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("project_livecom_events")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-livecom-events", projectId],
      });
      toast({
        title: "Deleted",
        description: "Event has been deleted successfully.",
      });
    },
    onError: (error) => {
      console.error("Error deleting event:", error);
      toast({
        title: "Error",
        description: "Failed to delete event.",
        variant: "destructive",
      });
    },
  });

  return {
    events,
    isLoading,
    createEvent: createEvent.mutate,
    updateEvent: updateEvent.mutateAsync,
    deleteEvent: deleteEvent.mutate,
    isCreating: createEvent.isPending,
    isUpdating: updateEvent.isPending,
    isDeleting: deleteEvent.isPending,
  };
}
