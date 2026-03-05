import { useState } from "react";
import { useProjectTasks, ProjectTask } from "@/hooks/useProjectTasks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProjectTaskDialog } from "./ProjectTaskDialog";
import { Plus, Pencil, Trash2, Flag, ChevronRight, ChevronDown, ListTree, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { DeleteConfirmDialog } from "./ui/delete-confirm-dialog";
import { Card, CardContent } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ProjectTaskManagerProps {
  projectId: string;
}

export function ProjectTaskManager({ projectId }: ProjectTaskManagerProps) {
  const { tasks, allTasksFlat, isLoading, createTask, updateTask, deleteTask } = useProjectTasks(projectId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | undefined>();
  const [parentTaskId, setParentTaskId] = useState<string | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const handleCreateTask = async (data: any) => {
    await createTask(data);
  };

  const handleUpdateTask = async (data: any) => {
    if (editingTask) {
      await updateTask({ id: editingTask.id, ...data });
    }
  };

  const handleDeleteTask = async () => {
    if (taskToDelete) {
      await deleteTask(taskToDelete);
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
    }
  };

  const openCreateDialog = (parentId?: string) => {
    setEditingTask(undefined);
    setParentTaskId(parentId);
    setDialogOpen(true);
  };

  const openEditDialog = (task: ProjectTask) => {
    setEditingTask(task);
    setParentTaskId(task.parent_task_id || undefined);
    setDialogOpen(true);
  };

  const openDeleteDialog = (taskId: string) => {
    setTaskToDelete(taskId);
    setDeleteDialogOpen(true);
  };

  const toggleExpanded = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      in_progress: "default",
      completed: "secondary",
      cancelled: "destructive",
    };
    return (
      <Badge variant={variants[status] || "default"} className="text-xs">
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const getPriorityIcon = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: "text-destructive",
      high: "text-orange-500",
      medium: "text-yellow-500",
      low: "text-muted-foreground",
    };
    return <Flag className={`h-3 w-3 ${colors[priority] || "text-muted-foreground"}`} />;
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (status === "completed" || status === "cancelled") return false;
    return new Date(dueDate) < new Date();
  };

  const renderTask = (task: ProjectTask, isSubtask: boolean = false) => {
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    const isExpanded = expandedTasks.has(task.id);

    return (
      <div key={task.id} className={isSubtask ? "ml-8 border-l-2 border-muted pl-4" : ""}>
        <div className={`flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors ${isSubtask ? "bg-muted/20" : "border"}`}>
          {/* Expand/Collapse for parent tasks */}
          <div className="w-6 flex-shrink-0">
            {hasSubtasks ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => toggleExpanded(task.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            ) : isSubtask ? (
              <div className="h-6 w-6 flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              </div>
            ) : null}
          </div>

          {/* Task Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {isSubtask && (
                    <ListTree className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className="font-medium text-sm">{task.task_name}</span>
                  {getPriorityIcon(task.priority)}
                  {getStatusBadge(task.status)}
                </div>
                {task.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {task.description}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {task.assigned_user?.full_name || task.assigned_user?.email || "Unassigned"}
                  </span>
                  <span className={isOverdue(task.due_date, task.status) ? "text-destructive font-medium" : ""}>
                    Due: {format(new Date(task.due_date), "MMM dd")}
                    {isOverdue(task.due_date, task.status) && " (Overdue)"}
                  </span>
                  {hasSubtasks && (
                    <span className="text-primary">
                      {task.subtasks!.length} subtask{task.subtasks!.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {!isSubtask && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openCreateDialog(task.id)}
                    title="Add Subtask"
                    className="h-7 w-7 p-0"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditDialog(task)}
                  className="h-7 w-7 p-0"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openDeleteDialog(task.id)}
                  className="h-7 w-7 p-0"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Subtasks */}
        {hasSubtasks && (
          <Collapsible open={isExpanded}>
            <CollapsibleContent className="mt-2 space-y-2">
              {task.subtasks!.map(subtask => renderTask(subtask, true))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Tasks</h3>
          <p className="text-sm text-muted-foreground">
            Manage tasks and subtasks
          </p>
        </div>
        <Button onClick={() => openCreateDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Alert variant="destructive" className="mb-4 max-w-md">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Tasks Required</AlertTitle>
              <AlertDescription>
                At least one task must be added before the project can move beyond "Pitched" status.
              </AlertDescription>
            </Alert>
            <ListTree className="h-10 w-10 text-muted-foreground mb-3" />
            <h4 className="font-medium mb-1">No tasks yet</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first task to get started
            </p>
            <Button onClick={() => openCreateDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => renderTask(task))}
        </div>
      )}

      <ProjectTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
        task={editingTask}
        projectId={projectId}
        parentTaskId={parentTaskId}
        parentTasks={allTasksFlat}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteTask}
        title="Delete Task"
        description="Are you sure you want to delete this task? All subtasks will also be deleted. This action cannot be undone."
      />
    </div>
  );
}
