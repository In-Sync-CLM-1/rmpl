import * as React from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ProjectTask } from "@/hooks/useProjectTasks";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ListTree } from "lucide-react";

interface ParentTask {
  id: string;
  task_name: string;
  parent_task_id: string | null;
  assigned_user?: {
    full_name: string | null;
    email: string | null;
  };
}

interface ProjectTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => Promise<void>;
  task?: ProjectTask;
  projectId: string;
  parentTaskId?: string;
  parentTasks?: ParentTask[];
}

interface TaskFormData {
  task_name: string;
  description: string;
  assigned_to: string;
  due_date: string;
  status: string;
  priority: string;
  parent_task_id: string | null;
}

export function ProjectTaskDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  task, 
  projectId,
  parentTaskId,
  parentTasks = []
}: ProjectTaskDialogProps) {
  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<TaskFormData>({
    defaultValues: task ? {
      task_name: task.task_name,
      description: task.description || "",
      assigned_to: task.assigned_to,
      due_date: task.due_date,
      status: task.status,
      priority: task.priority,
      parent_task_id: task.parent_task_id,
    } : {
      task_name: "",
      description: "",
      assigned_to: "",
      status: "pending",
      priority: "medium",
      due_date: new Date().toISOString().split('T')[0],
      parent_task_id: parentTaskId || null,
    },
  });

  const selectedParentTask = parentTasks.find(t => t.id === (parentTaskId || watch("parent_task_id")));

  // Reset form when task changes or dialog opens
  React.useEffect(() => {
    if (open) {
      if (task) {
        reset({
          task_name: task.task_name,
          description: task.description || "",
          assigned_to: task.assigned_to,
          due_date: task.due_date,
          status: task.status,
          priority: task.priority,
          parent_task_id: task.parent_task_id,
        });
      } else {
        reset({
          task_name: "",
          description: "",
          assigned_to: "",
          status: "pending",
          priority: "medium",
          due_date: new Date().toISOString().split('T')[0],
          parent_task_id: parentTaskId || null,
        });
      }
    }
  }, [open, task, parentTaskId, reset]);

  // Fetch team members for the project
  const { data: teamMembers, isLoading: isLoadingMembers, error: teamMembersError } = useQuery({
    queryKey: ["project-team-members", projectId, open],
    queryFn: async () => {
      console.log("Fetching team members for project:", projectId);
      
      const { data: teamMemberData, error: teamError } = await supabase
        .from("project_team_members")
        .select("user_id, role_in_project")
        .eq("project_id", projectId);

      if (teamError) {
        console.error("Error fetching team members:", teamError);
        throw teamError;
      }

      if (!teamMemberData || teamMemberData.length === 0) {
        console.log("No team members found");
        return [];
      }

      const userIds = teamMemberData.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        throw profilesError;
      }

      const result = teamMemberData.map(member => ({
        user_id: member.user_id,
        role_in_project: member.role_in_project,
        profile: profiles?.find(p => p.id === member.user_id)
      }));
      
      return result;
    },
    enabled: !!projectId && open,
    staleTime: 0,
  });

  React.useEffect(() => {
    if (teamMembersError) {
      console.error("Team members query error:", teamMembersError);
      toast.error("Failed to load team members");
    }
  }, [teamMembersError]);

  const handleFormSubmit = async (data: TaskFormData) => {
    if (!data.assigned_to) {
      toast.error("Please select a team member");
      return;
    }
    
    await onSubmit({
      ...data,
      project_id: projectId,
      parent_task_id: data.parent_task_id || null,
    });
    onOpenChange(false);
  };

  const statusValue = watch("status");
  const priorityValue = watch("priority");
  const assignedToValue = watch("assigned_to");
  const parentTaskIdValue = watch("parent_task_id");

  const isSubtask = !!parentTaskId || !!parentTaskIdValue;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {task ? "Edit Task" : isSubtask ? "Create Subtask" : "Create New Task"}
          </DialogTitle>
        </DialogHeader>

        {/* Parent Task Info */}
        {isSubtask && selectedParentTask && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <ListTree className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm">
              <span className="text-muted-foreground">Subtask of: </span>
              <span className="font-medium">{selectedParentTask.task_name}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task_name">Task Name *</Label>
            <Input
              id="task_name"
              {...register("task_name", { required: "Task name is required" })}
              placeholder="Enter task name"
            />
            {errors.task_name && (
              <p className="text-sm text-destructive">{errors.task_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Enter task description"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assigned_to">Assign To *</Label>
            <Select
              value={assignedToValue}
              onValueChange={(value) => setValue("assigned_to", value, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {isLoadingMembers ? (
                  <div className="px-2 py-1 text-sm text-muted-foreground">Loading...</div>
                ) : teamMembers && teamMembers.length > 0 ? (
                  teamMembers.map((member: any) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.profile?.full_name || member.profile?.email || "Unknown User"}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-1 text-sm text-muted-foreground">No team members found</div>
                )}
              </SelectContent>
            </Select>
            {(!teamMembers || teamMembers.length === 0) && !isLoadingMembers && (
              <p className="text-sm text-muted-foreground">
                No team members assigned to this project yet. Add team members first.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date *</Label>
              <Input
                id="due_date"
                type="date"
                {...register("due_date", { required: "Due date is required" })}
              />
              {errors.due_date && (
                <p className="text-sm text-destructive">{errors.due_date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={priorityValue}
                onValueChange={(value) => setValue("priority", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={statusValue}
              onValueChange={(value) => setValue("status", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : task ? "Update Task" : isSubtask ? "Create Subtask" : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
