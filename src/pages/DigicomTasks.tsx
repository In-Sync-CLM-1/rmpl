import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, startOfMonth, endOfMonth } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardList, Search, Clock, AlertTriangle, CheckCircle2, Loader2, XCircle, FolderKanban } from "lucide-react";

interface DigicomTask {
  id: string;
  task_name: string;
  assigned_to: string;
  assigned_by: string;
  due_date: string;
  status: string;
  priority: string | null;
  created_at: string;
  completed_at: string | null;
  task_type: "general" | "project";
  project_name?: string | null;
  assigned_user_name?: string;
  assigned_by_name?: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-blue-500/10 text-blue-700 ring-1 ring-blue-500/20", icon: Loader2 },
  completed: { label: "Completed", color: "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-slate-500/10 text-slate-600 ring-1 ring-slate-500/20", icon: XCircle },
};

const priorityConfig: Record<string, string> = {
  urgent: "bg-red-500 text-white",
  high: "bg-orange-500/15 text-orange-700 ring-1 ring-orange-500/20",
  medium: "bg-blue-500/10 text-blue-700 ring-1 ring-blue-500/20",
  low: "bg-slate-500/10 text-slate-600 ring-1 ring-slate-500/20",
};

export default function DigicomTasks() {
  const now = new Date();
  const [monthStart, setMonthStart] = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [monthEnd, setMonthEnd] = useState(format(endOfMonth(now), "yyyy-MM-dd"));
  const [statusFilter, setStatusFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Get Digicom team member IDs
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["digicom-team-members"],
    queryFn: async () => {
      const { data: team } = await supabase
        .from("teams")
        .select("id")
        .eq("name", "Digicom")
        .eq("is_active", true)
        .single();
      if (!team) return [];
      const { data: members } = await supabase
        .from("team_members")
        .select("user_id, profiles:user_id(id, full_name)")
        .eq("team_id", team.id)
        .eq("is_active", true);
      return (members || []).map((m: any) => ({
        id: m.profiles?.id,
        full_name: m.profiles?.full_name || "Unknown",
      })).filter((m: any) => m.id);
    },
  });

  const memberIds = teamMembers.map((m: any) => m.id);

  // Fetch all tasks for Digicom members
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["digicom-tasks", monthStart, monthEnd, memberIds],
    queryFn: async () => {
      if (memberIds.length === 0) return [];

      // General tasks
      const { data: generalTasks } = await supabase
        .from("general_tasks")
        .select("id, task_name, assigned_to, assigned_by, due_date, status, priority, created_at, completed_at, assigned_user:assigned_to(full_name), creator:assigned_by(full_name)")
        .in("assigned_to", memberIds)
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd + "T23:59:59")
        .order("created_at", { ascending: false });

      // Project tasks
      const { data: projectTasks } = await supabase
        .from("project_tasks")
        .select("id, task_name, assigned_to, assigned_by, due_date, status, priority, created_at, completed_at, project_id, assigned_user:assigned_to(full_name), creator:assigned_by(full_name), project:project_id(project_name)")
        .in("assigned_to", memberIds)
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd + "T23:59:59")
        .order("created_at", { ascending: false });

      const merged: DigicomTask[] = [
        ...(generalTasks || []).map((t: any) => ({
          ...t,
          task_type: "general" as const,
          project_name: null,
          assigned_user_name: t.assigned_user?.full_name,
          assigned_by_name: t.creator?.full_name,
        })),
        ...(projectTasks || []).map((t: any) => ({
          ...t,
          task_type: "project" as const,
          project_name: t.project?.project_name || null,
          assigned_user_name: t.assigned_user?.full_name,
          assigned_by_name: t.creator?.full_name,
        })),
      ];

      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return merged;
    },
    enabled: memberIds.length > 0,
  });

  const filtered = tasks.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (memberFilter !== "all" && t.assigned_to !== memberFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!t.task_name.toLowerCase().includes(q) && !(t.project_name || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const getDaysElapsed = (task: DigicomTask) => {
    const start = new Date(task.created_at);
    const end = task.completed_at ? new Date(task.completed_at) : new Date();
    return differenceInDays(end, start);
  };

  const isOverdue = (task: DigicomTask) => {
    if (task.status === "completed" || task.status === "cancelled") return false;
    return new Date(task.due_date) < new Date();
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [year, month] = e.target.value.split("-").map(Number);
    const d = new Date(year, month - 1, 1);
    setMonthStart(format(startOfMonth(d), "yyyy-MM-dd"));
    setMonthEnd(format(endOfMonth(d), "yyyy-MM-dd"));
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Digicom Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Memberwise task tracking for the Digicom team
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground font-medium">
            {filtered.length} task{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          type="month"
          value={monthStart.slice(0, 7)}
          onChange={handleMonthChange}
          className="w-44"
        />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-56"
          />
        </div>
        <Select value={memberFilter} onValueChange={setMemberFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Members" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Members</SelectItem>
            {teamMembers.map((m: any) => (
              <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading tasks..." />
        </div>
      ) : memberIds.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No team members"
          description="Add members to the Digicom team to see their tasks here"
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No tasks found"
          description="No tasks match the current filters"
        />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Task</TableHead>
                <TableHead className="font-semibold">Assigned To</TableHead>
                <TableHead className="font-semibold">Created By</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Priority</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Due Date</TableHead>
                <TableHead className="font-semibold text-right">Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((task) => {
                const days = getDaysElapsed(task);
                const overdue = isOverdue(task);
                const sc = statusConfig[task.status] || statusConfig.pending;
                const StatusIcon = sc.icon;
                return (
                  <TableRow
                    key={`${task.task_type}-${task.id}`}
                    className={overdue ? "bg-red-50/50 dark:bg-red-950/10" : ""}
                  >
                    <TableCell>
                      <div className="max-w-[280px]">
                        <p className="font-medium text-sm truncate">{task.task_name}</p>
                        {task.project_name && (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <FolderKanban className="h-3 w-3" />
                            {task.project_name}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{task.assigned_user_name || "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{task.assigned_by_name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-medium">
                        {task.task_type === "project" ? "Project" : "General"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {task.priority && (
                        <Badge className={`text-[10px] border-0 capitalize ${priorityConfig[task.priority] || priorityConfig.medium}`}>
                          {task.priority}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] border-0 gap-1 ${sc.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {sc.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        {overdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                        <span className={overdue ? "text-red-600 font-medium" : "text-muted-foreground"}>
                          {format(new Date(task.due_date), "dd MMM yy")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-sm font-semibold tabular-nums ${
                        task.status === "completed"
                          ? "text-emerald-600"
                          : overdue
                          ? "text-red-600"
                          : days > 5
                          ? "text-amber-600"
                          : "text-foreground"
                      }`}>
                        {days}d
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
