import { useState, useEffect } from "react";
import { FormDialog } from "./forms/FormDialog";
import { FormField } from "./forms/FormField";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { supabase } from "@/integrations/supabase/client";
import { ListTree, Lock } from "lucide-react";
import { Alert, AlertDescription } from "./ui/alert";

interface ParentTask {
  id: string;
  task_name: string;
  parent_task_id: string | null;
  assigned_user?: {
    full_name: string | null;
    email: string | null;
  };
}

interface TaskLike {
  id: string;
  task_name: string;
  description: string | null;
  assigned_to: string;
  assigned_by: string;
  due_date: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  parent_task_id?: string | null;
}

interface GeneralTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (task: any) => Promise<void>;
  task?: TaskLike | null;
  parentTaskId?: string;
  parentTasks?: ParentTask[];
  parentTaskName?: string;
  currentUserId?: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

export function GeneralTaskDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  task,
  parentTaskId,
  parentTasks = [],
  parentTaskName,
  currentUserId,
}: GeneralTaskDialogProps) {
  const [formData, setFormData] = useState({
    task_name: "",
    description: "",
    assigned_to: "",
    due_date: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    status: "pending" as "pending" | "in_progress" | "completed" | "cancelled",
    parent_task_id: null as string | null,
  });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const selectedParentTask = parentTasks.find(t => t.id === (parentTaskId || formData.parent_task_id));
  const isSubtask = !!parentTaskId || !!formData.parent_task_id;
  
  // Determine if the current user can change the assignee
  // Only the task creator can reassign a task
  const isEditing = !!task;
  const isCreator = task?.assigned_by === currentUserId;
  const canChangeAssignee = !isEditing || isCreator;

  useEffect(() => {
    if (open) {
      fetchProfiles();
      if (task) {
        setFormData({
          task_name: task.task_name,
          description: task.description || "",
          assigned_to: task.assigned_to,
          due_date: task.due_date.split("T")[0],
          priority: task.priority,
          status: task.status,
          parent_task_id: task.parent_task_id || null,
        });
      } else {
        setFormData({
          task_name: "",
          description: "",
          assigned_to: "",
          due_date: "",
          priority: "medium",
          status: "pending",
          parent_task_id: parentTaskId || null,
        });
      }
    }
  }, [open, task, parentTaskId]);

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name");
    if (data) setProfiles(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const submitData = {
        ...formData,
        description: formData.description || null,
        parent_task_id: formData.parent_task_id || null,
      };

      // If user cannot change assignee, don't include it in update
      if (isEditing && !canChangeAssignee) {
        delete (submitData as any).assigned_to;
      }

      if (task) {
        await onSubmit({ id: task.id, ...submitData });
      } else {
        await onSubmit(submitData);
      }
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  const getDialogTitle = () => {
    if (task) return "Edit Task";
    if (isSubtask) return "Create Subtask";
    return "Create New Task";
  };

  const getDialogDescription = () => {
    if (task) return "Update task details";
    if (isSubtask) return "Create a subtask under the parent task";
    return "Create a new task and assign it to a team member";
  };

  const getSubmitLabel = () => {
    if (task) return "Update Task";
    if (isSubtask) return "Create Subtask";
    return "Create Task";
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={getDialogTitle()}
      description={getDialogDescription()}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      submitLabel={getSubmitLabel()}
    >
      {/* Parent Task Info */}
      {isSubtask && (selectedParentTask || parentTaskName) && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg mb-4">
          <ListTree className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm">
            <span className="text-muted-foreground">Subtask of: </span>
            <span className="font-medium">{parentTaskName || selectedParentTask?.task_name}</span>
          </div>
        </div>
      )}

      <FormField label="Task Name" htmlFor="task_name" required>
        <Input
          id="task_name"
          value={formData.task_name}
          onChange={(e) => setFormData({ ...formData, task_name: e.target.value })}
          placeholder="Enter task name"
          required
        />
      </FormField>

      <FormField label="Description" htmlFor="description">
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Enter task description (optional)"
          rows={3}
        />
      </FormField>

      <FormField label="Assign To" htmlFor="assigned_to" required>
        {canChangeAssignee ? (
          <Select
            value={formData.assigned_to}
            onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
            required
          >
            <SelectTrigger id="assigned_to">
              <SelectValue placeholder="Select team member" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.full_name || profile.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <>
            <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-muted">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {profiles.find(p => p.id === formData.assigned_to)?.full_name || 
                 profiles.find(p => p.id === formData.assigned_to)?.email ||
                 "Loading..."}
              </span>
            </div>
            <Alert className="mt-2">
              <AlertDescription className="text-xs text-muted-foreground">
                Only the task creator can reassign this task
              </AlertDescription>
            </Alert>
          </>
        )}
      </FormField>

      <FormField label="Due Date" htmlFor="due_date" required>
        <Input
          id="due_date"
          type="date"
          value={formData.due_date}
          onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
          required
        />
      </FormField>

      <FormField label="Priority" htmlFor="priority" required>
        <Select
          value={formData.priority}
          onValueChange={(value: any) => setFormData({ ...formData, priority: value })}
        >
          <SelectTrigger id="priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      {task && (
        <FormField label="Status" htmlFor="status" required>
          <Select
            value={formData.status}
            onValueChange={(value: any) => setFormData({ ...formData, status: value })}
          >
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      )}
    </FormDialog>
  );
}