import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DemandComAllocation {
  id: string;
  project_id: string;
  user_id: string;
  registration_target: number;
  data_allocation: number;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    full_name: string | null;
  };
}

export interface TeamUser {
  id: string;
  full_name: string | null;
  team_id: string;
  team_name: string;
}

export interface Team {
  id: string;
  name: string;
}

export function useProjectDemandComAllocations(projectId: string | undefined) {
  const queryClient = useQueryClient();

  // Fetch allocations for the project
  const { data: allocations, isLoading: isLoadingAllocations } = useQuery({
    queryKey: ["project-demandcom-allocations", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from("project_demandcom_allocations")
        .select(`
          *,
          user:profiles!project_demandcom_allocations_user_id_fkey(
            id,
            full_name
          )
        `)
        .eq("project_id", projectId)
        .order("created_at");

      if (error) throw error;
      return (data || []) as DemandComAllocation[];
    },
    enabled: !!projectId,
  });

  // Fetch all teams
  const { data: teams, isLoading: isLoadingTeams } = useQuery({
    queryKey: ["teams-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return (data || []) as Team[];
    },
  });

  // Fetch all users with their team memberships
  const { data: allUsersWithTeams, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["all-users-with-teams"],
    queryFn: async () => {
      // First, get team members with their teams
      const { data: teamMembersData, error: teamMembersError } = await supabase
        .from("team_members")
        .select(`
          user_id,
          team_id,
          teams(id, name)
        `)
        .eq("is_active", true);

      if (teamMembersError) throw teamMembersError;
      if (!teamMembersData || teamMembersData.length === 0) return [];

      // Get unique user IDs
      const userIds = [...new Set(teamMembersData.map((m: any) => m.user_id))];

      // Fetch profiles for these users
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Create a map of profiles by ID
      const profilesMap = new Map(
        (profilesData || []).map((p: any) => [p.id, p])
      );

      // Combine the data
      return teamMembersData.map((m: any) => {
        const profile = profilesMap.get(m.user_id);
        return {
          id: m.user_id,
          full_name: profile?.full_name || null,
          team_id: m.team_id,
          team_name: m.teams?.name || "Unknown Team",
        };
      }).filter((u: any) => u.id) as TeamUser[];
    },
  });

  // Get available users (not already allocated)
  const availableUsers = allUsersWithTeams?.filter(
    (user) => !allocations?.some((a) => a.user_id === user.id)
  ) || [];

  // Calculate totals
  const totals = {
    registrationTarget: allocations?.reduce((sum, a) => sum + (a.registration_target || 0), 0) || 0,
    dataAllocation: allocations?.reduce((sum, a) => sum + (a.data_allocation || 0), 0) || 0,
  };

  // Add user allocation
  const addAllocation = useMutation({
    mutationFn: async (userId: string) => {
      if (!projectId) throw new Error("Project ID is required");

      const { error } = await supabase
        .from("project_demandcom_allocations")
        .insert({
          project_id: projectId,
          user_id: userId,
          registration_target: 0,
          data_allocation: 0,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-demandcom-allocations", projectId],
      });
      toast.success("User added to allocations");
    },
    onError: (error) => {
      console.error("Error adding allocation:", error);
      toast.error("Failed to add user");
    },
  });

  // Add multiple users at once
  const addAllAllocations = useMutation({
    mutationFn: async (userIds: string[]) => {
      if (!projectId) throw new Error("Project ID is required");
      if (userIds.length === 0) throw new Error("No users to add");

      const allocationsToInsert = userIds.map((userId) => ({
        project_id: projectId,
        user_id: userId,
        registration_target: 0,
        data_allocation: 0,
      }));

      const { error } = await supabase
        .from("project_demandcom_allocations")
        .insert(allocationsToInsert);

      if (error) throw error;
      return userIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({
        queryKey: ["project-demandcom-allocations", projectId],
      });
      toast.success(`${count} users added to allocations`);
    },
    onError: (error) => {
      console.error("Error adding allocations:", error);
      toast.error("Failed to add users");
    },
  });

  // Update allocation
  const updateAllocation = useMutation({
    mutationFn: async ({
      allocationId,
      data,
    }: {
      allocationId: string;
      data: {
        registration_target?: number;
        data_allocation?: number;
      };
    }) => {
      const { error } = await supabase
        .from("project_demandcom_allocations")
        .update(data)
        .eq("id", allocationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-demandcom-allocations", projectId],
      });
    },
    onError: (error) => {
      console.error("Error updating allocation:", error);
      toast.error("Failed to update allocation");
    },
  });

  // Remove allocation
  const removeAllocation = useMutation({
    mutationFn: async (allocationId: string) => {
      const { error } = await supabase
        .from("project_demandcom_allocations")
        .delete()
        .eq("id", allocationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-demandcom-allocations", projectId],
      });
      toast.success("User removed from allocations");
    },
    onError: (error) => {
      console.error("Error removing allocation:", error);
      toast.error("Failed to remove user");
    },
  });

  return {
    allocations: allocations || [],
    availableUsers,
    teams: teams || [],
    totals,
    isLoading: isLoadingAllocations || isLoadingTeams || isLoadingUsers,
    isAdding: addAllocation.isPending || addAllAllocations.isPending,
    isUpdating: updateAllocation.isPending,
    isRemoving: removeAllocation.isPending,
    addAllocation: addAllocation.mutate,
    addAllAllocations: addAllAllocations.mutate,
    updateAllocation: updateAllocation.mutate,
    removeAllocation: removeAllocation.mutate,
  };
}
