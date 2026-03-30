import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ProjectTask {
  id: string;
  project_id: string;
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
  completion_notes?: string | null;
  completion_file_path?: string | null;
  completion_file_name?: string | null;
  completion_files?: any;
  restart_reason?: string | null;
  restarted_at?: string | null;
  restarted_by?: string | null;
  assigned_user?: {
    full_name: string | null;
    email: string | null;
  };
  subtasks?: ProjectTask[];
}

export function useProjectTasks(projectId: string) {
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          assigned_user:profiles!tasks_assigned_to_fkey (
            full_name,
            email
          )
        `)
        .eq("project_id", projectId)
        .not("project_id", "is", null)
        .order("due_date", { ascending: true });

      if (error) throw error;

      // Organize tasks into hierarchy
      const taskMap = new Map<string, ProjectTask>();
      const rootTasks: ProjectTask[] = [];

      // First pass: create map of all tasks
      (data as ProjectTask[]).forEach(task => {
        taskMap.set(task.id, { ...task, subtasks: [] });
      });

      // Second pass: organize into hierarchy
      taskMap.forEach(task => {
        if (task.parent_task_id && taskMap.has(task.parent_task_id)) {
          const parent = taskMap.get(task.parent_task_id)!;
          parent.subtasks = parent.subtasks || [];
          parent.subtasks.push(task);
        } else if (!task.parent_task_id) {
          rootTasks.push(task);
        }
      });

      return rootTasks;
    },
    enabled: !!projectId,
  });

  // Fetch all tasks flat (for parent task selection)
  const { data: allTasksFlat } = useQuery({
    queryKey: ["project-tasks-flat", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          id,
          task_name,
          parent_task_id,
          assigned_user:profiles!tasks_assigned_to_fkey (
            full_name,
            email
          )
        `)
        .eq("project_id", projectId)
        .not("project_id", "is", null)
        .is("parent_task_id", null) // Only top-level tasks can be parents
        .order("task_name", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const createTask = useMutation({
    mutationFn: async (taskData: Omit<ProjectTask, "id" | "created_at" | "updated_at" | "completed_at" | "assigned_user" | "subtasks">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("tasks")
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
      queryClient.invalidateQueries({
        queryKey: ["project-tasks", projectId],
        exact: true
      });
      queryClient.invalidateQueries({
        queryKey: ["project-tasks-flat", projectId],
        exact: true
      });
      toast.success("Task created successfully");
    },
    onError: (error: Error) => {
      console.error("Error creating task:", error);
      toast.error("Failed to create task");
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProjectTask> & { id: string }) => {
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
      queryClient.invalidateQueries({
        queryKey: ["project-tasks", projectId],
        exact: true
      });
      queryClient.invalidateQueries({
        queryKey: ["project-tasks-flat", projectId],
        exact: true
      });
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
        .from("tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-tasks", projectId],
        exact: true
      });
      queryClient.invalidateQueries({
        queryKey: ["project-tasks-flat", projectId],
        exact: true
      });
      toast.success("Task deleted successfully");
    },
    onError: (error: Error) => {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    },
  });

  return {
    tasks: tasks || [],
    allTasksFlat: allTasksFlat || [],
    isLoading,
    createTask: createTask.mutateAsync,
    updateTask: updateTask.mutateAsync,
    deleteTask: deleteTask.mutateAsync,
    isCreating: createTask.isPending,
    isUpdating: updateTask.isPending,
    isDeleting: deleteTask.isPending,
  };
}
