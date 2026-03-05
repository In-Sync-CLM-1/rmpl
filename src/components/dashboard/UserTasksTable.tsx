import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isPast, isToday, differenceInDays } from "date-fns";
import { ChevronRight, ListTodo, AlertCircle, Clock, Briefcase, CornerDownRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface Task {
  id: string;
  task_name: string;
  description: string | null;
  due_date: string;
  status: string;
  priority: string;
  task_type: "general" | "project";
  project_name?: string;
  parent_task_id?: string | null;
  is_subtask: boolean;
}

const priorityConfig: Record<string, { bg: string; text: string; label: string }> = {
  low: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400", label: "low" },
  medium: { bg: "bg-blue-100 dark:bg-blue-900/50", text: "text-blue-600 dark:text-blue-400", label: "medium" },
  high: { bg: "bg-orange-100 dark:bg-orange-900/50", text: "text-orange-600 dark:text-orange-400", label: "high" },
  urgent: { bg: "bg-gradient-to-r from-red-500 to-rose-500", text: "text-white", label: "urgent" },
};

const statusConfig: Record<string, { bg: string; text: string }> = {
  pending: { bg: "bg-yellow-100 dark:bg-yellow-900/50", text: "text-yellow-700 dark:text-yellow-400" },
  in_progress: { bg: "bg-blue-100 dark:bg-blue-900/50", text: "text-blue-700 dark:text-blue-400" },
  completed: { bg: "bg-green-100 dark:bg-green-900/50", text: "text-green-700 dark:text-green-400" },
  cancelled: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400" },
};

export function UserTasksTable() {
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["user-dashboard-tasks"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Fetch general tasks assigned to user
      const { data: generalTasks, error: generalError } = await supabase
        .from("general_tasks")
        .select("*")
        .eq("assigned_to", user.id)
        .neq("status", "completed")
        .neq("status", "cancelled")
        .order("due_date", { ascending: true })
        .limit(10);

      if (generalError) throw generalError;

      // Fetch project tasks assigned to user
      const { data: projectTasks, error: projectError } = await supabase
        .from("project_tasks")
        .select(`
          *,
          project:projects!project_tasks_project_id_fkey(project_name)
        `)
        .eq("assigned_to", user.id)
        .neq("status", "completed")
        .neq("status", "cancelled")
        .order("due_date", { ascending: true })
        .limit(10);

      if (projectError) throw projectError;

      // Format and merge tasks
      const formattedGeneralTasks: Task[] = (generalTasks || []).map((t) => ({
        id: t.id,
        task_name: t.task_name,
        description: t.description,
        due_date: t.due_date,
        status: t.status,
        priority: t.priority || "medium",
        task_type: "general" as const,
        parent_task_id: t.parent_task_id,
        is_subtask: !!t.parent_task_id,
      }));

      const formattedProjectTasks: Task[] = (projectTasks || []).map((t: any) => ({
        id: t.id,
        task_name: t.task_name,
        description: t.description,
        due_date: t.due_date,
        status: t.status,
        priority: t.priority || "medium",
        task_type: "project" as const,
        project_name: t.project?.project_name,
        is_subtask: false,
      }));

      // Merge and sort by due date
      return [...formattedGeneralTasks, ...formattedProjectTasks].sort(
        (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      ).slice(0, 5);
    },
  });

  const isOverdue = (dueDate: string) => {
    const date = new Date(dueDate);
    return isPast(date) && !isToday(date);
  };

  const isDueSoon = (dueDate: string) => {
    const date = new Date(dueDate);
    const today = new Date();
    const diff = differenceInDays(date, today);
    return diff >= 0 && diff <= 2;
  };

  const getDueDateStyle = (dueDate: string) => {
    if (isOverdue(dueDate)) return "text-red-600 dark:text-red-400 font-medium";
    if (isToday(new Date(dueDate))) return "text-amber-600 dark:text-amber-400 font-medium";
    return "text-muted-foreground";
  };

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 bg-muted">
          <CardTitle className="flex items-center gap-2 text-base text-foreground">
            <ListTodo className="h-4 w-4" />
            My Tasks
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 flex flex-row items-center justify-between bg-muted">
        <div>
          <CardTitle className="flex items-center gap-2 text-base text-foreground">
            <ListTodo className="h-4 w-4" />
            My Tasks
          </CardTitle>
          <CardDescription className="text-xs mt-1 text-muted-foreground">
            {tasks?.length || 0} pending tasks assigned to you
          </CardDescription>
        </div>
        <Link to="/tasks">
          <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 text-foreground hover:bg-accent">
            View All <ChevronRight className="h-3 w-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="pt-3 pb-3">
        {!tasks || tasks.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <ListTodo className="h-8 w-8 mx-auto mb-1 opacity-50" />
            <p>No pending tasks</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => {
              const priority = priorityConfig[task.priority] || priorityConfig.medium;
              const status = statusConfig[task.status] || statusConfig.pending;
              const dueSoon = isDueSoon(task.due_date);
              const overdue = isOverdue(task.due_date);
              
              return (
                <Link 
                  to={`/tasks?taskId=${task.id}&type=${task.task_type}`}
                  key={task.id} 
                  className={`flex items-center justify-between p-2 rounded-lg transition-colors border-l-3 cursor-pointer ${
                    overdue 
                      ? 'bg-red-50 dark:bg-red-950/30 border-l-red-500 ring-1 ring-red-200 dark:ring-red-800 hover:bg-red-100 dark:hover:bg-red-950/50' 
                      : dueSoon 
                        ? 'bg-amber-50 dark:bg-amber-950/30 border-l-amber-500 ring-1 ring-amber-200 dark:ring-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/50'
                        : 'bg-muted/30 hover:bg-muted/50 border-l-violet-400'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {task.is_subtask ? (
                      <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800">
                        <CornerDownRight className="h-3 w-3 text-slate-500" />
                      </div>
                    ) : task.task_type === "project" ? (
                      <div className="p-1.5 rounded-md bg-cyan-100 dark:bg-cyan-900/30">
                        <Briefcase className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
                      </div>
                    ) : (
                      <div className="p-1.5 rounded-md bg-violet-100 dark:bg-violet-900/30">
                        <ListTodo className="h-3 w-3 text-violet-600 dark:text-violet-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{task.task_name}</p>
                      {task.project_name && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {task.project_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge className={`text-[10px] px-1.5 py-0 h-5 ${priority.bg} ${priority.text} border-0`}>
                      {priority.label}
                    </Badge>
                    <Badge className={`text-[10px] px-1.5 py-0 h-5 ${status.bg} ${status.text} border-0`}>
                      {task.status.replace("_", " ")}
                    </Badge>
                    <div className={`text-[10px] flex items-center gap-0.5 ${getDueDateStyle(task.due_date)}`}>
                      {isOverdue(task.due_date) ? (
                        <AlertCircle className="h-3 w-3" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      )}
                      {format(new Date(task.due_date), "dd MMM")}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}