import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, CheckCircle2, Clock, Calendar, FolderKanban } from "lucide-react";
import { format } from "date-fns";

interface TaskPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (task: {
    id: string;
    task_name: string;
    task_type: "general" | "project";
    project_name?: string;
  }) => void;
}

export function TaskPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: TaskPickerDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all tasks from unified tasks table
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks-for-chat", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select(`
          id,
          task_name,
          description,
          status,
          due_date,
          priority,
          project_id,
          project:projects!tasks_project_id_fkey(project_name, project_number)
        `)
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.ilike("task_name", `%${searchQuery}%`);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getPriorityVariant = (priority: string | null): "default" | "destructive" | "secondary" | "outline" => {
    switch (priority) {
      case "high":
      case "urgent":
        return "destructive";
      case "medium":
        return "secondary";
      default:
        return "outline";
    }
  };

  const handleSelect = (task: any) => {
    const taskType = task.project_id ? "project" : "general";
    onSelect({
      id: task.id,
      task_name: task.task_name,
      task_type: taskType,
      project_name: task.project?.project_name
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share a Task</DialogTitle>
        </DialogHeader>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[300px] mt-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tasks found
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task: any) => (
                <button
                  key={task.id}
                  onClick={() => handleSelect(task)}
                  className="w-full p-3 rounded-lg hover:bg-muted text-left transition-colors"
                >
                  <div className="flex items-start gap-2">
                    {getStatusIcon(task.status)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-1">
                        {task.task_name}
                      </p>
                      {task.project && (
                        <p className="text-xs text-primary flex items-center gap-1 mt-0.5">
                          <FolderKanban className="h-3 w-3" />
                          {task.project.project_name}
                        </p>
                      )}
                      {!task.project_id && task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(task.due_date), "MMM d, yyyy")}
                        </span>
                        {task.priority && (
                          <Badge
                            variant={getPriorityVariant(task.priority)}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {task.priority}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
