import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GeneralTask {
  id: string;
  task_name: string;
  description: string | null;
  assigned_to: string;
  assigned_by: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  parent_task_id: string | null;
  assigned_user?: {
    full_name: string | null;
    email: string | null;
  };
  subtasks?: GeneralTask[];
}

interface TaskFilters {
  status?: "pending" | "in_progress" | "completed" | "cancelled" | "all";
  itemsPerPage?: number;
  currentPage?: number;
}

export function useGeneralTasks(filters?: TaskFilters) {
  const queryClient = useQueryClient();
  const status = filters?.status || "all";
  const itemsPerPage = filters?.itemsPerPage || 10;
  const currentPage = filters?.currentPage || 1;

  const staleTime = 60 * 1000; // 1 minute for tasks

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["general-tasks", status, currentPage, itemsPerPage],
    staleTime,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
        .from("general_tasks")
        .select(`*`, { count: 'exact' })
        .or(`assigned_to.eq.${user.id},assigned_by.eq.${user.id}`)
        .order("due_date", { ascending: true })
        .range(from, to);

      if (status !== "all") {
        query = query.eq("status", status);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      
      // Organize tasks into hierarchy
      const taskMap = new Map<string, GeneralTask>();
      const rootTasks: GeneralTask[] = [];
      
      (data as GeneralTask[]).forEach(task => {
        taskMap.set(task.id, { ...task, subtasks: [] });
      });
      
      taskMap.forEach(task => {
        if (task.parent_task_id && taskMap.has(task.parent_task_id)) {
          const parent = taskMap.get(task.parent_task_id)!;
          parent.subtasks = parent.subtasks || [];
          parent.subtasks.push(task);
        } else if (!task.parent_task_id) {
          rootTasks.push(task);
        }
      });
      
      return { data: rootTasks, count: count || 0 };
    },
  });

  // Fetch all tasks flat (for parent task selection)
  const { data: allTasksFlat } = useQuery({
    queryKey: ["general-tasks-flat"],
    staleTime,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("general_tasks")
        .select(`
          id,
          task_name,
          parent_task_id
        `)
        .or(`assigned_to.eq.${user.id},assigned_by.eq.${user.id}`)
        .is("parent_task_id", null)
        .order("task_name", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const { data: taskCounts } = useQuery({
    queryKey: ["general-task-counts"],
    staleTime,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const [pending, inProgress, overdue] = await Promise.all([
        supabase
          .from("general_tasks")
          .select("*", { count: 'exact', head: true })
          .or(`assigned_to.eq.${user.id},assigned_by.eq.${user.id}`)
          .eq("status", "pending"),
        supabase
          .from("general_tasks")
          .select("*", { count: 'exact', head: true })
          .or(`assigned_to.eq.${user.id},assigned_by.eq.${user.id}`)
          .eq("status", "in_progress"),
        supabase
          .from("general_tasks")
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
    mutationFn: async (taskData: Omit<GeneralTask, "id" | "created_at" | "updated_at" | "completed_at" | "assigned_user" | "subtasks">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("general_tasks")
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
      queryClient.invalidateQueries({ queryKey: ["general-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["general-tasks-flat"] });
      queryClient.invalidateQueries({ queryKey: ["general-task-counts"] });
      toast.success("Task created successfully");
    },
    onError: (error: Error) => {
      console.error("Error creating task:", error);
      toast.error("Failed to create task");
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<GeneralTask> & { id: string }) => {
      const { data, error } = await supabase
        .from("general_tasks")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["general-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["general-tasks-flat"] });
      queryClient.invalidateQueries({ queryKey: ["general-task-counts"] });
      toast.success("Task updated successfully");
    },
    onError: (error: Error) => {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("general_tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["general-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["general-tasks-flat"] });
      queryClient.invalidateQueries({ queryKey: ["general-task-counts"] });
      toast.success("Task deleted successfully");
    },
    onError: (error: Error) => {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    },
  });

  return {
    tasks: tasks?.data || [],
    allTasksFlat: allTasksFlat || [],
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
