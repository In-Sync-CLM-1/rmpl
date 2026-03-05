import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, Clock, AlertCircle, FolderKanban } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TaskShareCardProps {
  task: {
    id: string;
    task_name: string;
    description: string | null;
    status: string;
    due_date: string;
    priority: string | null;
  };
  isOwnMessage?: boolean;
  projectName?: string | null;
}

export function TaskShareCard({ task, isOwnMessage, projectName }: TaskShareCardProps) {
  const getStatusIcon = () => {
    switch (task.status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getPriorityColor = () => {
    switch (task.priority) {
      case "high":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const isOverdue = new Date(task.due_date) < new Date() && task.status !== "completed";

  return (
    <div
      className={cn(
        "rounded-lg p-3 min-w-[200px] max-w-[280px]",
        isOwnMessage
          ? "bg-primary-foreground/10"
          : "bg-background"
      )}
    >
      {projectName && (
        <div className={cn(
          "flex items-center gap-1 text-xs mb-2 pb-2 border-b",
          isOwnMessage ? "text-primary-foreground/70 border-primary-foreground/20" : "text-primary border-border"
        )}>
          <FolderKanban className="h-3 w-3" />
          <span className="truncate">{projectName}</span>
        </div>
      )}
      <div className="flex items-start gap-2 mb-2">
        {getStatusIcon()}
        <span className="font-medium text-sm flex-1 line-clamp-2">
          {task.task_name}
        </span>
      </div>

      {task.description && (
        <p
          className={cn(
            "text-xs mb-2 line-clamp-2",
            isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div
          className={cn(
            "flex items-center gap-1 text-xs",
            isOverdue ? "text-red-500" : isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          <Calendar className="h-3 w-3" />
          {format(new Date(task.due_date), "MMM d, yyyy")}
        </div>

        {task.priority && (
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getPriorityColor())}>
            {task.priority}
          </Badge>
        )}
      </div>
    </div>
  );
}
