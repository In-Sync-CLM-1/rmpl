import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Play, CheckCircle2, XCircle, ExternalLink, ChevronDown, ChevronRight, ListTree, RefreshCw, FileText, Download } from "lucide-react";
import { useAllTasks, getOverdueDays, UnifiedTask } from "@/hooks/useAllTasks";
import { GeneralTaskDialog } from "@/components/GeneralTaskDialog";
import { RestartTaskDialog } from "@/components/RestartTaskDialog";
import { CompleteTaskDialog } from "@/components/CompleteTaskDialog";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { supabase } from "@/integrations/supabase/client";
import { UpcomingProjects } from "@/components/UpcomingProjects";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";

export default function Tasks() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "in_progress" | "completed" | "cancelled">("all");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<UnifiedTask | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [createdDateFrom, setCreatedDateFrom] = useState<string>("");
  const [createdDateTo, setCreatedDateTo] = useState<string>("");
  const [dueDateFrom, setDueDateFrom] = useState<string>("");
  const [dueDateTo, setDueDateTo] = useState<string>("");
  const [parentTaskForSubtask, setParentTaskForSubtask] = useState<UnifiedTask | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [restartDialogOpen, setRestartDialogOpen] = useState(false);
  const [taskToRestart, setTaskToRestart] = useState<UnifiedTask | null>(null);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<UnifiedTask | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    fetchUser();
  }, []);

  const { tasks, totalCount, isLoading, createTask, updateTask, deleteTask, restartTask } = useAllTasks({
    status: statusFilter,
    itemsPerPage,
    currentPage,
    createdDateFrom,
    createdDateTo,
    dueDateFrom,
    dueDateTo,
  });

  const handleCreateTask = () => {
    setSelectedTask(null);
    setParentTaskForSubtask(null);
    setDialogOpen(true);
  };

  const handleCreateSubtask = (parentTask: UnifiedTask) => {
    setSelectedTask(null);
    setParentTaskForSubtask(parentTask);
    setDialogOpen(true);
  };

  const handleEditTask = (task: UnifiedTask) => {
    // Only general tasks can be edited via dialog
    if (task.task_type === "general") {
      setSelectedTask(task);
      setParentTaskForSubtask(null);
      setDialogOpen(true);
    } else {
      // Navigate to project detail page for project tasks
      navigate(`/projects/view/${task.project_id}`);
    }
  };

  const handleDeleteTask = async (taskId: string, taskType: "general" | "project") => {
    if (confirm("Are you sure you want to delete this task?")) {
      await deleteTask({ id: taskId, task_type: taskType });
    }
  };

  const handleStartTask = async (task: UnifiedTask) => {
    await updateTask({ id: task.id, task_type: task.task_type, status: "in_progress" });
  };

  const handleOpenCompleteDialog = (task: UnifiedTask) => {
    setTaskToComplete(task);
    setCompleteDialogOpen(true);
  };

  const handleCompleteTask = async (notes: string, files: File[]) => {
    if (!taskToComplete) return;
    
    const uploadedFiles: { path: string; name: string; size: number }[] = [];
    
    // Upload all files
    for (const file of files) {
      const filePath = `${taskToComplete.task_type}/${taskToComplete.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("task-completion-files")
        .upload(filePath, file);
      
      if (uploadError) {
        toast.error(`Failed to upload ${file.name}`);
        console.error("Upload error:", uploadError);
      } else {
        uploadedFiles.push({
          path: filePath,
          name: file.name,
          size: file.size,
        });
      }
    }
    
    // For backward compatibility, also set the single file fields if there's at least one file
    const completion_file_path = uploadedFiles.length > 0 ? uploadedFiles[0].path : null;
    const completion_file_name = uploadedFiles.length > 0 ? uploadedFiles[0].name : null;
    
    await updateTask({ 
      id: taskToComplete.id, 
      task_type: taskToComplete.task_type,
      status: "completed", 
      completed_at: new Date().toISOString(),
      completion_notes: notes,
      completion_file_path,
      completion_file_name,
      completion_files: uploadedFiles,
    } as any);
    
    if (uploadedFiles.length > 0) {
      toast.success(`${uploadedFiles.length} file${uploadedFiles.length !== 1 ? 's' : ''} uploaded successfully`);
    }
    
    setTaskToComplete(null);
  };

  const handleCancelTask = async (task: UnifiedTask) => {
    await updateTask({ id: task.id, task_type: task.task_type, status: "cancelled" });
  };

  const handleOpenRestartDialog = (task: UnifiedTask) => {
    setTaskToRestart(task);
    setRestartDialogOpen(true);
  };

  const handleRestartTask = async (reason: string) => {
    if (!taskToRestart) return;
    await restartTask({ 
      id: taskToRestart.id, 
      task_type: taskToRestart.task_type, 
      restart_reason: reason 
    });
    setTaskToRestart(null);
  };

  const handleSubmit = async (taskData: any) => {
    if (selectedTask) {
      // Editing existing task
      await updateTask({ id: selectedTask.id, task_type: "general", ...taskData });
    } else {
      // Creating new task or subtask
      await createTask(taskData);
    }
  };

  const toggleTaskExpanded = (taskId: string) => {
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "destructive";
      case "high": return "default";
      case "medium": return "secondary";
      case "low": return "outline";
      default: return "outline";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "in_progress": return "secondary";
      case "pending": return "outline";
      case "cancelled": return "destructive";
      default: return "outline";
    }
  };

  const getDaysOpen = (createdAt: string): number => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffTime = now.getTime() - created.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const renderSubtasks = (subtasks: UnifiedTask[] | undefined, level: number = 1) => {
    if (!subtasks || subtasks.length === 0) return null;

    return (
      <div className={`space-y-2 ${level === 1 ? 'mt-3 pt-3 border-t border-border' : ''}`}>
        {subtasks.map((subtask) => {
          const overdueDays = getOverdueDays(subtask.due_date, subtask.status);
          return (
            <div 
              key={subtask.id} 
              className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
              style={{ marginLeft: `${level * 16}px` }}
            >
              <ListTree className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{subtask.task_name}</span>
                  <Badge variant={getStatusColor(subtask.status)} className="text-xs">
                    {subtask.status.replace("_", " ")}
                  </Badge>
                  <Badge variant={getPriorityColor(subtask.priority)} className="text-xs">
                    {subtask.priority}
                  </Badge>
                  {overdueDays > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      Overdue {overdueDays}d
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                  <span>Due: {format(new Date(subtask.due_date), "MMM dd")}</span>
                  {subtask.assigned_user && (
                    <span>• {subtask.assigned_user.full_name || subtask.assigned_user.email}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {subtask.status === "pending" && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleStartTask(subtask)}>
                    <Play className="h-3 w-3" />
                  </Button>
                )}
                {subtask.status === "in_progress" && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleOpenCompleteDialog(subtask)}>
                    <CheckCircle2 className="h-3 w-3" />
                  </Button>
                )}
                {currentUserId === subtask.assigned_by && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleEditTask(subtask)}>
                    <Edit className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTaskCard = (task: UnifiedTask) => {
    const overdueDays = getOverdueDays(task.due_date, task.status);
    const daysOpen = getDaysOpen(task.created_at);
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    const isExpanded = expandedTasks.has(task.id);
    const canAddSubtask = currentUserId === task.assigned_to && 
                          task.task_type === "general" && 
                          !task.parent_task_id &&
                          task.status !== "completed" &&
                          task.status !== "cancelled";

    return (
      <Card key={task.id} className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                {hasSubtasks && (
                  <button 
                    onClick={() => toggleTaskExpanded(task.id)}
                    className="p-0.5 hover:bg-muted rounded"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                )}
                <CardTitle className="text-lg">{task.task_name}</CardTitle>
                {task.task_type === "project" && task.project_number && (
                  <Badge 
                    variant="outline" 
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => navigate(`/projects/view/${task.project_id}`)}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    {task.project_number}
                  </Badge>
                )}
                {hasSubtasks && (
                  <Badge variant="secondary" className="text-xs">
                    {task.subtasks?.length} subtask{task.subtasks!.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              <CardDescription className="space-y-2">
                {task.description && (
                  <p className="text-sm">{task.description}</p>
                )}
                {task.task_type === "project" && task.project_name && (
                  <p className="text-sm text-muted-foreground">
                    <strong>Project:</strong> {task.project_name}
                  </p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={task.task_type === "project" ? "secondary" : "outline"}>
                    {task.task_type === "project" ? "Project Task" : "General Task"}
                  </Badge>
                  <Badge variant={getStatusColor(task.status)}>
                    {task.status.replace("_", " ")}
                  </Badge>
                  <Badge variant={getPriorityColor(task.priority)}>
                    {task.priority}
                  </Badge>
                  <Badge variant="outline" className="text-muted-foreground">
                    Open {daysOpen} day{daysOpen !== 1 ? "s" : ""}
                  </Badge>
                  {overdueDays > 0 && (
                    <Badge variant="destructive">
                      Overdue by {overdueDays} day{overdueDays > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
                <div className="text-sm space-y-1">
                  <p><strong>Due Date:</strong> {format(new Date(task.due_date), "MMM dd, yyyy")}</p>
                  <p className="text-muted-foreground"><strong>Created:</strong> {format(new Date(task.created_at), "MMM dd, yyyy")}</p>
                  {task.assigned_user && (
                    <p className="text-muted-foreground">
                      <strong>Assigned to:</strong> {task.assigned_user.full_name || task.assigned_user.email}
                    </p>
                  )}
                  {task.assigned_by_user && (
                    <p className="text-muted-foreground">
                      <strong>Assigned by:</strong> {task.assigned_by_user.full_name || task.assigned_by_user.email}
                    </p>
                  )}
                  {task.restart_reason && (
                    <p className="text-muted-foreground">
                      <strong>Restart reason:</strong> {task.restart_reason}
                    </p>
                  )}
                  {task.status === "completed" && task.completion_notes && (
                    <p className="text-muted-foreground">
                      <strong>Completion notes:</strong> {task.completion_notes}
                    </p>
                  )}
                  {task.status === "completed" && task.completion_file_path && task.completion_file_name && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <a 
                        href={`${supabase.storage.from("task-completion-files").getPublicUrl(task.completion_file_path).data.publicUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        {task.completion_file_name}
                        <Download className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {task.status === "pending" && (
                <Button size="sm" variant="outline" onClick={() => handleStartTask(task)}>
                  <Play className="h-4 w-4 mr-1" />
                  Start
                </Button>
              )}
              {task.status === "in_progress" && (
                <Button size="sm" variant="default" onClick={() => handleOpenCompleteDialog(task)}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Complete
                </Button>
              )}
              {(task.status === "pending" || task.status === "in_progress") && (
                <Button size="sm" variant="destructive" onClick={() => handleCancelTask(task)}>
                  <XCircle className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              )}
              {canAddSubtask && (
                <Button size="sm" variant="outline" onClick={() => handleCreateSubtask(task)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Subtask
                </Button>
              )}
              {(task.status === "completed" || task.status === "cancelled") && currentUserId === task.assigned_by && (
                <Button size="sm" variant="outline" onClick={() => handleOpenRestartDialog(task)}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Restart
                </Button>
              )}
              {currentUserId === task.assigned_by && task.task_type === "general" && (
                <Button size="sm" variant="ghost" onClick={() => handleEditTask(task)}>
                  Edit
                </Button>
              )}
            </div>
          </div>
          
          {/* Subtasks Section */}
          {hasSubtasks && isExpanded && renderSubtasks(task.subtasks)}
        </CardHeader>
      </Card>
    );
  };

  return (
    <div className="px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold mb-1">Tasks</h2>
          <p className="text-sm text-muted-foreground">Manage and track all your tasks</p>
        </div>
        <Button onClick={handleCreateTask}>
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left side - Tasks (2/3 width) */}
        <div className="col-span-2">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Tabs value={statusFilter} onValueChange={(v: any) => { setStatusFilter(v); setCurrentPage(1); }}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="in_progress">In Progress</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Items per page:</span>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date Filters */}
          <div className="mb-6 grid grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Created Date</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={createdDateFrom}
                    onChange={(e) => { setCreatedDateFrom(e.target.value); setCurrentPage(1); }}
                    placeholder="From"
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <input
                    type="date"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={createdDateTo}
                    onChange={(e) => { setCreatedDateTo(e.target.value); setCurrentPage(1); }}
                    placeholder="To"
                  />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Due Date</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={dueDateFrom}
                    onChange={(e) => { setDueDateFrom(e.target.value); setCurrentPage(1); }}
                    placeholder="From"
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <input
                    type="date"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={dueDateTo}
                    onChange={(e) => { setDueDateTo(e.target.value); setCurrentPage(1); }}
                    placeholder="To"
                  />
                </div>
              </div>
            </Card>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No tasks found</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 mb-6">
                {tasks.map((task: UnifiedTask) => renderTaskCard(task))}
              </div>

              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalCount}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(value) => {
                  setItemsPerPage(value);
                  setCurrentPage(1);
                }}
              />
            </>
          )}
        </div>

        {/* Right side - Upcoming Projects (1/3 width) */}
        <div className="col-span-1">
          <UpcomingProjects />
        </div>
      </div>

      <GeneralTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        task={selectedTask}
        parentTaskId={parentTaskForSubtask?.id}
        parentTaskName={parentTaskForSubtask?.task_name}
        currentUserId={currentUserId || undefined}
      />

      <RestartTaskDialog
        open={restartDialogOpen}
        onOpenChange={setRestartDialogOpen}
        onConfirm={handleRestartTask}
        taskName={taskToRestart?.task_name || ""}
      />

      <CompleteTaskDialog
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        onConfirm={handleCompleteTask}
        taskName={taskToComplete?.task_name || ""}
      />
    </div>
  );
}