import { useState, useEffect } from "react";
import { FormDialog } from "./forms/FormDialog";
import { FormField } from "./forms/FormField";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ProjectTask } from "@/hooks/useProjectTasks";

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (task: any) => Promise<void>;
  task?: ProjectTask | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

export function TaskDialog({ open, onOpenChange, onSubmit, task }: TaskDialogProps) {
  const [formData, setFormData] = useState({
    task_name: "",
    description: "",
    assigned_to: "",
    due_date: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    status: "pending" as "pending" | "in_progress" | "completed" | "cancelled",
  });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
        });
      } else {
        setFormData({
          task_name: "",
          description: "",
          assigned_to: "",
          due_date: "",
          priority: "medium",
          status: "pending",
        });
      }
    }
  }, [open, task]);

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
        project_id: null,
        description: formData.description || null,
      };

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

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={task ? "Edit Task" : "Create New Task"}
      description={task ? "Update task details" : "Create a new task and assign it to a team member"}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      submitLabel={task ? "Update Task" : "Create Task"}
    >
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
        <Select
          value={formData.assigned_to}
          onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
          required
        >
          <SelectTrigger id="assigned_to">
            <SelectValue placeholder="Select a user" />
          </SelectTrigger>
          <SelectContent>
            {profiles.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profile.full_name || profile.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      <div className="grid grid-cols-2 gap-4">
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
      </div>
    </FormDialog>
  );
}
