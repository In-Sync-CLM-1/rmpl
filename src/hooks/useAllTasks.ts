import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UnifiedTask {
  id: string;
  task_name: string;
  description: string | null;
  assigned_to: string;
  assigned_by: string;
  due_date: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  parent_task_id: string | null;
  task_type: "general" | "project";
  project_id?: string | null;
  project_number?: string | null;
  project_name?: string;
  assigned_user?: {
    full_name: string | null;
    email: string | null;
  };
  assigned_by_user?: {
    full_name: string | null;
    email: string | null;
  };
  restart_reason?: string | null;
  restarted_at?: string | null;
  restarted_by?: string | null;
  completion_notes?: string | null;
  completion_file_path?: string | null;
  completion_file_name?: string | null;
  subtasks?: UnifiedTask[];
}

interface TaskFilters {
  status?: string;
  itemsPerPage?: number;
  currentPage?: number;
  createdDateFrom?: string;
  createdDateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}

export function useAllTasks(filters?: TaskFilters) {
  const queryClient = useQueryClient();
  const status = filters?.status;
  const itemsPerPage = filters?.itemsPerPage || 10;
  const currentPage = filters?.currentPage || 1;

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ["all-tasks", status, itemsPerPage, currentPage, filters?.createdDateFrom, filters?.createdDateTo, filters?.dueDateFrom, filters?.dueDateTo],
    queryFn: async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      // Fetch all tasks from unified tasks table with FK joins
      let query = supabase
        .from("tasks")
        .select(`
          *,
          assigned_user:profiles!tasks_assigned_to_fkey(full_name, email),
          assigned_by_user:profiles!tasks_assigned_by_fkey(full_name, email),
          project:projects!tasks_project_id_fkey(id, project_number, project_name)
        `, { count: "exact" });

      // Filter to only show tasks assigned to or created by current user
      if (userId) {
        query = query.or(`assigned_to.eq.${userId},assigned_by.eq.${userId}`);
      }

      if (status && status !== "all") {
        query = query.eq("status", status);
      }

      // Apply date filters
      if (filters?.createdDateFrom) {
        query = query.gte("created_at", filters.createdDateFrom);
      }
      if (filters?.createdDateTo) {
        query = query.lte("created_at", filters.createdDateTo);
      }
      if (filters?.dueDateFrom) {
        query = query.gte("due_date", filters.dueDateFrom);
      }
      if (filters?.dueDateTo) {
        query = query.lte("due_date", filters.dueDateTo);
      }

      query = query.order("due_date", { ascending: true });

      const { data: allTasksRaw, error, count } = await query;
      if (error) throw error;

      // Format tasks
      const formattedTasks: UnifiedTask[] = (allTasksRaw || []).map((task: any) => ({
        ...task,
        task_type: task.project_id ? ("project" as const) : ("general" as const),
        project_id: task.project_id,
        project_number: task.project?.project_number,
        project_name: task.project?.project_name,
        status: task.status as "pending" | "in_progress" | "completed" | "cancelled",
        priority: (task.priority || "medium") as "low" | "medium" | "high" | "urgent",
        assigned_user: task.assigned_user || null,
        assigned_by_user: task.assigned_by_user || null,
      }));

      // Build hierarchy
      const taskMap = new Map<string, UnifiedTask>();
      const rootTasks: UnifiedTask[] = [];

      formattedTasks.forEach(task => {
        taskMap.set(task.id, { ...task, subtasks: [] });
      });

      taskMap.forEach(task => {
        if (task.parent_task_id && taskMap.has(task.parent_task_id)) {
          // Parent exists in taskMap - attach as subtask
          const parent = taskMap.get(task.parent_task_id)!;
          parent.subtasks = parent.subtasks || [];
          parent.subtasks.push(task);
        } else if (!task.parent_task_id) {
          // Root task - add to root list
          rootTasks.push(task);
        } else {
          // Orphan subtask (parent not in taskMap) - treat as root task
          // This handles subtasks assigned to user when parent is assigned to someone else
          rootTasks.push(task);
        }
      });

      // Apply pagination after hierarchy building
      const from = (currentPage - 1) * itemsPerPage;
      const paginatedTasks = rootTasks.slice(from, from + itemsPerPage);

      return {
        tasks: paginatedTasks,
        totalCount: count || 0,
      };
    },
  });

  const createTask = useMutation({
    mutationFn: async (taskData: {
      task_name: string;
      description?: string | null;
      assigned_to: string;
      due_date: string;
      priority: "low" | "medium" | "high" | "urgent";
      status?: "pending" | "in_progress" | "completed" | "cancelled";
      parent_task_id?: string | null;
      project_id?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          ...taskData,
          assigned_by: user.id,
          status: taskData.status || "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["general-tasks"] });
      toast.success("Task created successfully");
    },
    onError: (error: Error) => {
      console.error("Error creating task:", error);
      toast.error("Failed to create task");
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({
      id,
      task_type,
      ...updates
    }: Partial<UnifiedTask> & { id: string; task_type: "general" | "project" }) => {
      const { data, error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["general-tasks"] });
      toast.success("Task updated successfully");
    },
    onError: (error: any) => {
      console.error("Error updating task:", error);
      const detail = error?.message || error?.details || "Unknown error";
      toast.error(`Failed to update task: ${detail}`);
    },
  });

  const deleteTask = useMutation({
    mutationFn: async ({ id, task_type }: { id: string; task_type: "general" | "project" }) => {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["general-tasks"] });
      toast.success("Task deleted successfully");
    },
    onError: (error: Error) => {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    },
  });

  const restartTask = useMutation({
    mutationFn: async ({
      id,
      task_type,
      restart_reason
    }: { id: string; task_type: "general" | "project"; restart_reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("tasks")
        .update({
          status: "pending",
          restart_reason,
          restarted_at: new Date().toISOString(),
          restarted_by: user.id,
          completed_at: null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["general-tasks"] });
      toast.success("Task restarted successfully");
    },
    onError: (error: Error) => {
      console.error("Error restarting task:", error);
      toast.error("Failed to restart task");
    },
  });

  return {
    tasks: tasksData?.tasks || [],
    totalCount: tasksData?.totalCount || 0,
    isLoading,
    createTask: createTask.mutateAsync,
    updateTask: updateTask.mutateAsync,
    deleteTask: deleteTask.mutateAsync,
    restartTask: restartTask.mutateAsync,
    isCreating: createTask.isPending,
    isUpdating: updateTask.isPending,
    isDeleting: deleteTask.isPending,
    isRestarting: restartTask.isPending,
  };
}

export const getOverdueDays = (dueDate: string, status: string): number => {
  if (status === "completed" || status === "cancelled") return 0;

  const now = new Date();
  const due = new Date(dueDate);
  const diffTime = now.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 0;
};
