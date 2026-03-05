import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProjectTask } from "./useProjectTasks";

interface TaskFilters {
  status?: "pending" | "in_progress" | "completed" | "cancelled" | "all";
  itemsPerPage?: number;
  currentPage?: number;
}

export function useTasks(filters?: TaskFilters) {
  const queryClient = useQueryClient();
  const status = filters?.status || "all";
  const itemsPerPage = filters?.itemsPerPage || 10;
  const currentPage = filters?.currentPage || 1;

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["all-tasks", status, currentPage, itemsPerPage],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
        .from("project_tasks")
        .select(`
          *,
          assigned_user:profiles!project_tasks_assigned_to_fkey (
            full_name,
            email
          ),
          assigned_by_user:profiles!project_tasks_assigned_by_fkey (
            full_name,
            email
          )
        `, { count: 'exact' })
        .or(`assigned_to.eq.${user.id},assigned_by.eq.${user.id}`)
        .order("due_date", { ascending: true })
        .range(from, to);

      if (status !== "all") {
        query = query.eq("status", status);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      return { data: data as ProjectTask[], count: count || 0 };
    },
  });

  const { data: taskCounts } = useQuery({
    queryKey: ["task-counts"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const [pending, inProgress, overdue] = await Promise.all([
        supabase
          .from("project_tasks")
          .select("*", { count: 'exact', head: true })
          .or(`assigned_to.eq.${user.id},assigned_by.eq.${user.id}`)
          .eq("status", "pending"),
        supabase
          .from("project_tasks")
          .select("*", { count: 'exact', head: true })
          .or(`assigned_to.eq.${user.id},assigned_by.eq.${user.id}`)
          .eq("status", "in_progress"),
        supabase
          .from("project_tasks")
          .select("*", { count: 'exact', head: true })
          .or(`assigned_to.eq.${user.id},assigned_by.eq.${user.id}`)
          .lt("due_date", new Date().toISOString())
          .neq("status", "completed")
          .neq("status", "cancelled"),
      ]);

      return {
        pending: pending.count || 0,
        inProgress: inProgress.count || 0,
        overdue: overdue.count || 0,
      };
    },
  });

  const createTask = useMutation({
    mutationFn: async (taskData: Omit<ProjectTask, "id" | "created_at" | "updated_at" | "completed_at" | "assigned_user">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("project_tasks")
        .insert({
          ...taskData,
          assigned_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-counts"] });
      toast.success("✅ Task created successfully");
    },
    onError: (error: Error) => {
      console.error("Error creating task:", error);
      toast.error("Failed to create task");
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProjectTask> & { id: string }) => {
      const { data, error } = await supabase
        .from("project_tasks")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-counts"] });
      toast.success("✅ Task updated successfully");
    },
    onError: (error: Error) => {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("project_tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-counts"] });
      toast.success("✅ Task deleted successfully");
    },
    onError: (error: Error) => {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    },
  });

  return {
    tasks: tasks?.data || [],
    totalCount: tasks?.count || 0,
    taskCounts,
    isLoading,
    createTask: createTask.mutateAsync,
    updateTask: updateTask.mutateAsync,
    deleteTask: deleteTask.mutateAsync,
    isCreating: createTask.isPending,
    isUpdating: updateTask.isPending,
    isDeleting: deleteTask.isPending,
  };
}

export const getOverdueDays = (dueDate: string, status: string) => {
  if (status === "completed" || status === "cancelled") return 0;
  const due = new Date(dueDate);
  const today = new Date();
  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};
