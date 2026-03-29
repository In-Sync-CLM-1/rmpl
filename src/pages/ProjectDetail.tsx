import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pencil, Users, Calendar, MapPin, FileText, CheckCircle2, Clock, AlertCircle, Download, Target, Building2, Phone, UserCheck, Paperclip, Receipt, IndianRupee } from "lucide-react";
import { ProjectTaskManager } from "@/components/ProjectTaskManager";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { toast } from "sonner";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Project {
  id: string;
  project_number: string;
  project_name: string;
  brief: string | null;
  status: string;
  client_id: string | null;
  contact_id: string | null;
  project_source: string | null;
  referrer_name: string | null;
  locations: any[];
  event_dates: any[];
  created_at: string;
  project_team_members?: Array<{
    id: string;
    user_id: string;
    role_in_project: string;
    profiles?: {
      full_name: string | null;
      email: string | null;
    };
  }>;
  project_files?: Array<{
    id: string;
    file_name: string;
    file_path: string;
    file_type: string | null;
    file_size: number | null;
    uploaded_at: string;
  }>;
  project_quotations?: Array<{
    id: string;
    quotation_number: string;
    file_name: string | null;
    file_path: string | null;
    amount: number | null;
    paid_amount: number | null;
    status: string;
    client_id: string | null;
    client?: { company_name: string | null };
    invoice_date: string | null;
    created_at: string;
  }>;
}

// Circular Progress Component
const CircularProgress = ({ 
  value, 
  size = 80, 
  strokeWidth = 8,
  color = "hsl(var(--primary))",
  bgColor = "hsl(var(--muted))",
  children 
}: { 
  value: number; 
  size?: number; 
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  children?: React.ReactNode;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(value, 100) / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
};

// Mini stat card with color variants
const StatMini = ({ icon: Icon, label, value, subValue, colorClass = "bg-primary/10 text-primary" }: { icon: any; label: string; value: string | number; subValue?: string; colorClass?: string }) => (
  <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-card to-muted/30 border border-border/50 hover:shadow-md transition-all">
    <div className={`p-2 rounded-lg ${colorClass}`}>
      <Icon className="h-4 w-4" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-muted-foreground truncate">{label}</p>
      <p className="font-semibold text-sm truncate">{value}</p>
      {subValue && <p className="text-xs text-muted-foreground truncate">{subValue}</p>}
    </div>
  </div>
);

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { permissions } = useUserPermissions();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(`
          *,
          project_team_members (
            id,
            user_id,
            role_in_project
          ),
          project_files (
            id,
            file_name,
            file_path,
            file_type,
            file_size,
            uploaded_at
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;

      if (data.project_team_members && data.project_team_members.length > 0) {
        const userIds = data.project_team_members.map((m: any) => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        data.project_team_members = data.project_team_members.map((member: any) => ({
          ...member,
          profiles: profiles?.find(p => p.id === member.user_id) || { full_name: null, email: null }
        }));
      }

      const { data: quotations } = await supabase
        .from("project_quotations")
        .select("*")
        .eq("project_id", id);

      (data as any).project_quotations = quotations || [];

      return data as Project;
    },
    enabled: !!id,
  });

  const { data: taskStats } = useQuery({
    queryKey: ["project-task-stats", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, status, parent_task_id, task_name, due_date")
        .eq("project_id", id)
        .not("project_id", "is", null);

      if (error) throw error;
      
      const parentTasks = data.filter(t => !t.parent_task_id);
      const subtasks = data.filter(t => t.parent_task_id);
      const pendingTasks = data.filter(t => t.status === "pending" || t.status === "in_progress");
      
      return {
        totalParent: parentTasks.length,
        totalSubtasks: subtasks.length,
        total: data.length,
        pending: data.filter(t => t.status === "pending").length,
        inProgress: data.filter(t => t.status === "in_progress").length,
        completed: data.filter(t => t.status === "completed").length,
        pendingTasks: pendingTasks.slice(0, 5), // Top 5 pending/in-progress tasks
      };
    },
    enabled: !!id,
  });

  const { data: registrationStats } = useQuery({
    queryKey: ["project-registration-stats", id, project?.project_name],
    queryFn: async () => {
      if (!project?.project_name) return null;

      const { data: allocations } = await supabase
        .from("project_demandcom_allocations")
        .select("registration_target, data_allocation")
        .eq("project_id", id);

      const targetRegistrations = allocations?.reduce((sum, a) => sum + (a.registration_target || 0), 0) || 0;
      const totalAllocated = allocations?.reduce((sum, a) => sum + (a.data_allocation || 0), 0) || 0;

      const { count: actualRegistrations } = await supabase
        .from("demandcom")
        .select("*", { count: "exact", head: true })
        .eq("activity_name", project.project_name)
        .eq("latest_subdisposition", "Registered");

      return {
        target: targetRegistrations,
        actual: actualRegistrations || 0,
        percentage: targetRegistrations > 0 ? Math.round(((actualRegistrations || 0) / targetRegistrations) * 100) : 0,
        allocated: totalAllocated,
        teamMembers: allocations?.length || 0,
      };
    },
    enabled: !!id && !!project?.project_name,
  });

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; bg: string }> = {
      pitched: { label: "Pitched", color: "text-amber-600", bg: "bg-amber-100" },
      in_discussion: { label: "In Discussion", color: "text-blue-600", bg: "bg-blue-100" },
      estimate_shared: { label: "Estimate Shared", color: "text-purple-600", bg: "bg-purple-100" },
      po_received: { label: "PO Received", color: "text-emerald-600", bg: "bg-emerald-100" },
      execution: { label: "Execution", color: "text-primary", bg: "bg-primary/10" },
      invoiced: { label: "Invoiced", color: "text-cyan-600", bg: "bg-cyan-100" },
      closed: { label: "Closed", color: "text-green-600", bg: "bg-green-100" },
      lost: { label: "Lost", color: "text-destructive", bg: "bg-destructive/10" },
    };
    return configs[status] || { label: status, color: "text-muted-foreground", bg: "bg-muted" };
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownloadFile = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage.from("project-files").download(filePath);
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download file");
    }
  };

  const handleDownloadInvoice = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage.from("project-quotations").download(filePath);
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download invoice");
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-background p-6 flex items-center justify-center">
        <div className="animate-pulse space-y-4 w-full max-w-4xl">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-screen bg-background p-6 flex items-center justify-center">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  const locations = Array.isArray(project.locations) ? project.locations : [];
  const eventDates = Array.isArray(project.event_dates) ? project.event_dates : [];
  const statusConfig = getStatusConfig(project.status);
  const taskCompletionPercentage = taskStats && taskStats.total > 0 
    ? Math.round((taskStats.completed / taskStats.total) * 100) 
    : 0;
  
  const totalInvoiceAmount = project.project_quotations?.reduce((sum, q) => sum + (q.amount || 0), 0) || 0;
  const totalPaidAmount = project.project_quotations?.reduce((sum, q) => sum + (q.paid_amount || 0), 0) || 0;
  const paymentPercentage = totalInvoiceAmount > 0 ? Math.round((totalPaidAmount / totalInvoiceAmount) * 100) : 0;

  return (
    <div className="h-screen bg-gradient-to-br from-background via-background to-muted/30 overflow-hidden flex flex-col">
      {/* Compact Header with gradient */}
      <div className="flex-none px-6 py-4 border-b bg-gradient-to-r from-card via-card to-primary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/projects")} className="h-8 w-8 hover:bg-primary/10">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-primary/70">{project.project_number}</span>
                <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">{project.project_name}</h1>
                <Badge className={`${statusConfig.bg} ${statusConfig.color} border-0 shadow-sm`}>
                  {statusConfig.label}
                </Badge>
              </div>
              {project.brief && (
                <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl truncate">{project.brief}</p>
              )}
            </div>
          </div>
          {permissions.canManageProjects && (
            <Button size="sm" onClick={() => navigate(`/projects/edit/${id}`)} className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md">
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Main Content - Grid Layout */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="summary" className="h-full flex flex-col">
          <div className="flex-none px-6 pt-3">
            <TabsList className="h-9">
              <TabsTrigger value="summary" className="text-xs">Summary</TabsTrigger>
              <TabsTrigger value="tasks" className="text-xs">Tasks</TabsTrigger>
              <TabsTrigger value="files" className="text-xs">Files & Invoices</TabsTrigger>
            </TabsList>
          </div>

          {/* Summary Tab - One Page Dashboard */}
          <TabsContent value="summary" className="flex-1 p-6 pt-4 m-0 overflow-hidden">
            <div className="grid grid-cols-12 gap-3 h-[calc(100vh-180px)]">
              {/* Left Column - Progress Rings */}
              <div className="col-span-3 flex flex-col gap-3">
                {/* Registration Progress */}
                <Card className="p-3 bg-gradient-to-br from-blue-500/10 via-card to-card border-blue-200/50 dark:border-blue-800/50 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col items-center text-center">
                    <CircularProgress 
                      value={registrationStats?.percentage || 0} 
                      size={72} 
                      strokeWidth={8}
                      color={registrationStats?.percentage && registrationStats.percentage >= 100 ? "hsl(142 76% 36%)" : "hsl(217 91% 60%)"}
                      bgColor="hsl(217 91% 60% / 0.15)"
                    >
                      <span className="text-base font-bold text-blue-600">{registrationStats?.percentage || 0}%</span>
                    </CircularProgress>
                    <p className="text-xs font-semibold mt-2 text-blue-700 dark:text-blue-400">Registrations</p>
                    <span className="text-[10px] text-muted-foreground">{registrationStats?.actual || 0}/{registrationStats?.target || 0}</span>
                  </div>
                </Card>

                {/* Task Progress */}
                <Card className="p-3 bg-gradient-to-br from-purple-500/10 via-card to-card border-purple-200/50 dark:border-purple-800/50 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col items-center text-center">
                    <CircularProgress 
                      value={taskCompletionPercentage}
                      size={72} 
                      strokeWidth={8}
                      color={taskCompletionPercentage >= 100 ? "hsl(142 76% 36%)" : "hsl(280 85% 65%)"}
                      bgColor="hsl(280 85% 65% / 0.15)"
                    >
                      <span className="text-base font-bold text-purple-600">{taskCompletionPercentage}%</span>
                    </CircularProgress>
                    <p className="text-xs font-semibold mt-2 text-purple-700 dark:text-purple-400">Tasks</p>
                    <span className="text-[10px] text-muted-foreground">{taskStats?.completed || 0}/{taskStats?.total || 0} done</span>
                  </div>
                </Card>

                {/* Payment Progress */}
                <Card className="p-3 bg-gradient-to-br from-emerald-500/10 via-card to-card border-emerald-200/50 dark:border-emerald-800/50 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col items-center text-center">
                    <CircularProgress 
                      value={paymentPercentage} 
                      size={72} 
                      strokeWidth={8}
                      color={paymentPercentage >= 100 ? "hsl(142 76% 36%)" : "hsl(142 76% 36%)"}
                      bgColor="hsl(142 76% 36% / 0.15)"
                    >
                      <span className="text-base font-bold text-emerald-600">{paymentPercentage}%</span>
                    </CircularProgress>
                    <p className="text-xs font-semibold mt-2 text-emerald-700 dark:text-emerald-400">Payments</p>
                    <span className="text-[10px] text-muted-foreground">
                      ₹{(totalPaidAmount / 100000).toFixed(1)}L / ₹{(totalInvoiceAmount / 100000).toFixed(1)}L
                    </span>
                  </div>
                </Card>
              </div>

              {/* Middle Column - Key Info */}
              <div className="col-span-5 flex flex-col gap-3 overflow-hidden">
                {/* Project Details Grid */}
                <Card className="p-3 flex-none bg-gradient-to-br from-card to-muted/20 border-border/50 shadow-sm">
                  <h3 className="text-xs font-semibold mb-2 flex items-center gap-2 text-foreground">
                    <div className="p-1 rounded bg-primary/10"><Building2 className="h-3 w-3 text-primary" /></div>
                    Project Info
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <StatMini 
                      icon={Target} 
                      label="Source" 
                      value={project.project_source === "reference" ? "Reference" : project.project_source === "inbound" ? "Inbound" : "Outbound"}
                      subValue={project.referrer_name || undefined}
                      colorClass="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                    />
                    <StatMini 
                      icon={Calendar} 
                      label="Event Dates" 
                      value={`${eventDates.length} date(s)`}
                      subValue={eventDates[0] ? format(new Date(eventDates[0].date), "dd MMM") : undefined}
                      colorClass="bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400"
                    />
                    <StatMini 
                      icon={MapPin} 
                      label="Locations" 
                      value={`${locations.length} venue(s)`}
                      subValue={locations[0]?.city || undefined}
                      colorClass="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
                    />
                    <StatMini 
                      icon={Users} 
                      label="Team" 
                      value={`${project.project_team_members?.length || 0} member(s)`}
                      colorClass="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                    />
                  </div>
                </Card>

                {/* Event Schedule */}
                {eventDates.length > 0 && (
                  <Card className="p-3 flex-none bg-gradient-to-br from-cyan-500/5 via-card to-card border-cyan-200/30 shadow-sm">
                    <h3 className="text-xs font-semibold mb-2 flex items-center gap-2">
                      <div className="p-1 rounded bg-cyan-100 dark:bg-cyan-900/30"><Calendar className="h-3 w-3 text-cyan-600" /></div>
                      Schedule
                    </h3>
                    <div className="grid grid-cols-4 gap-1.5">
                      {eventDates.slice(0, 4).map((dateInfo: any, idx: number) => (
                        <div key={idx} className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border border-cyan-200/50 dark:border-cyan-700/30 text-center shadow-sm">
                          <p className="text-sm font-bold text-cyan-700 dark:text-cyan-400">{format(new Date(dateInfo.date), "dd")}</p>
                          <p className="text-[10px] text-cyan-600/70">{format(new Date(dateInfo.date), "MMM")}</p>
                        </div>
                      ))}
                    </div>
                    {eventDates.length > 4 && (
                      <p className="text-[10px] text-cyan-600 text-center mt-1">+{eventDates.length - 4} more dates</p>
                    )}
                  </Card>
                )}

                {/* Pending Tasks List */}
                <Card className="p-3 flex-1 min-h-0 overflow-hidden flex flex-col bg-gradient-to-br from-amber-500/5 via-card to-card border-amber-200/30 shadow-sm">
                  <h3 className="text-xs font-semibold mb-2 flex items-center gap-2 flex-none">
                    <div className="p-1 rounded bg-amber-100 dark:bg-amber-900/30"><AlertCircle className="h-3 w-3 text-amber-600" /></div>
                    Pending Tasks
                  </h3>
                  {taskStats?.pendingTasks && taskStats.pendingTasks.length > 0 ? (
                    <div className="space-y-1.5 overflow-auto flex-1">
                      {taskStats.pendingTasks.map((task: any) => (
                        <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-900/10 dark:to-orange-900/10 border border-amber-100 dark:border-amber-800/30 text-xs">
                          <div className={`h-2.5 w-2.5 rounded-full shrink-0 shadow-sm ${task.status === "in_progress" ? "bg-blue-500 ring-2 ring-blue-200" : "bg-amber-500 ring-2 ring-amber-200"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-foreground">{task.task_name}</p>
                            {task.due_date && (
                              <p className="text-[10px] text-amber-600">Due: {format(new Date(task.due_date), "dd MMM")}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
                      <p className="text-xs text-emerald-600 font-medium">All tasks completed!</p>
                    </div>
                  )}
                </Card>

                {/* Locations */}
                {locations.length > 0 && (
                  <Card className="p-3 flex-none bg-gradient-to-br from-rose-500/5 via-card to-card border-rose-200/30 shadow-sm">
                    <h3 className="text-xs font-semibold mb-2 flex items-center gap-2">
                      <div className="p-1 rounded bg-rose-100 dark:bg-rose-900/30"><MapPin className="h-3 w-3 text-rose-600" /></div>
                      Venues
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {locations.slice(0, 4).map((loc: any, idx: number) => (
                        <Badge key={idx} className="text-[10px] bg-gradient-to-r from-rose-100 to-pink-100 text-rose-700 border-rose-200 dark:from-rose-900/30 dark:to-pink-900/30 dark:text-rose-400 dark:border-rose-700/30">
                          {loc.city}
                        </Badge>
                      ))}
                      {locations.length > 4 && (
                        <Badge variant="outline" className="text-[10px] border-rose-300 text-rose-600">+{locations.length - 4}</Badge>
                      )}
                    </div>
                  </Card>
                )}
              </div>

              {/* Right Column - Team & Quick Stats */}
              <div className="col-span-4 flex flex-col gap-3 overflow-hidden">
                {/* Quick Stats Bar */}
                <Card className="p-3 flex-none bg-gradient-to-r from-primary/10 via-purple-500/10 to-cyan-500/10 border-primary/20 shadow-sm">
                  <div className="grid grid-cols-4 divide-x divide-primary/20">
                    <div className="text-center px-1">
                      <p className="text-lg font-bold text-blue-600">{project.project_files?.length || 0}</p>
                      <p className="text-[10px] text-blue-600/70">Files</p>
                    </div>
                    <div className="text-center px-1">
                      <p className="text-lg font-bold text-emerald-600">{project.project_quotations?.length || 0}</p>
                      <p className="text-[10px] text-emerald-600/70">Invoices</p>
                    </div>
                    <div className="text-center px-1">
                      <p className="text-lg font-bold text-purple-600">{taskStats?.totalParent || 0}</p>
                      <p className="text-[10px] text-purple-600/70">Tasks</p>
                    </div>
                    <div className="text-center px-1">
                      <p className="text-lg font-bold text-orange-600">{registrationStats?.teamMembers || 0}</p>
                      <p className="text-[10px] text-orange-600/70">Agents</p>
                    </div>
                  </div>
                </Card>

                {/* Team Members */}
                <Card className="p-3 flex-1 min-h-0 overflow-hidden flex flex-col bg-gradient-to-br from-indigo-500/5 via-card to-card border-indigo-200/30 shadow-sm">
                  <h3 className="text-xs font-semibold mb-2 flex items-center gap-2 flex-none">
                    <div className="p-1 rounded bg-indigo-100 dark:bg-indigo-900/30"><Users className="h-3 w-3 text-indigo-600" /></div>
                    Team
                  </h3>
                  {project.project_team_members && project.project_team_members.length > 0 ? (
                    <div className="space-y-1.5 overflow-auto flex-1">
                      {project.project_team_members.slice(0, 6).map((member, idx) => {
                        const colors = ["bg-blue-500", "bg-purple-500", "bg-emerald-500", "bg-rose-500", "bg-amber-500", "bg-cyan-500"];
                        return (
                          <div key={member.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/10 dark:to-purple-900/10 border border-indigo-100 dark:border-indigo-800/30">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className={`text-[10px] ${colors[idx % colors.length]} text-white`}>
                                {member.profiles?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{member.profiles?.full_name || "Unknown"}</p>
                              <p className="text-[10px] text-indigo-600/70 truncate">{member.role_in_project}</p>
                            </div>
                          </div>
                        );
                      })}
                      {project.project_team_members.length > 6 && (
                        <p className="text-[10px] text-indigo-600 text-center">+{project.project_team_members.length - 6} more</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-indigo-500 text-center py-4">No team members</p>
                  )}
                </Card>

                {/* Task Breakdown Mini */}
                {taskStats && taskStats.total > 0 && (
                  <Card className="p-3 flex-none bg-gradient-to-br from-violet-500/5 via-card to-card border-violet-200/30 shadow-sm">
                    <h3 className="text-xs font-semibold mb-2 flex items-center gap-2">
                      <div className="p-1 rounded bg-violet-100 dark:bg-violet-900/30"><CheckCircle2 className="h-3 w-3 text-violet-600" /></div>
                      Task Status
                    </h3>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30">
                        <div className="h-2 w-2 rounded-full bg-amber-500" />
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">{taskStats.pending}</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-400">{taskStats.inProgress}</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{taskStats.completed}</span>
                      </div>
                    </div>
                    {taskStats.totalSubtasks > 0 && (
                      <p className="text-[10px] text-violet-600 mt-1.5 text-center">
                        {taskStats.totalSubtasks} subtasks
                      </p>
                    )}
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="flex-1 overflow-auto p-6 pt-4 m-0">
            <Card className="p-4">
              <ProjectTaskManager projectId={id!} />
            </Card>
          </TabsContent>

          {/* Files & Invoices Tab */}
          <TabsContent value="files" className="flex-1 overflow-auto p-6 pt-4 m-0">
            <div className="grid grid-cols-2 gap-6">
              {/* Files */}
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Paperclip className="h-4 w-4" /> Project Files
                </h3>
                {project.project_files && project.project_files.length > 0 ? (
                  <div className="space-y-2">
                    {project.project_files.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{file.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.file_size)} • {format(new Date(file.uploaded_at), "dd MMM yyyy")}
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownloadFile(file.file_path, file.file_name)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No files uploaded</p>
                )}
              </Card>

              {/* Invoices */}
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Receipt className="h-4 w-4" /> Invoices & Quotations
                </h3>
                {project.project_quotations && project.project_quotations.length > 0 ? (
                  <div className="space-y-2">
                    {project.project_quotations.map((q) => {
                      const isPaid = q.paid_amount && q.amount && q.paid_amount >= q.amount;
                      const isPartial = q.paid_amount && q.paid_amount > 0 && q.amount && q.paid_amount < q.amount;
                      return (
                        <div key={q.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <IndianRupee className="h-4 w-4 text-primary shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{q.quotation_number || q.file_name || `#${q.id.slice(0, 8)}`}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>₹{(q.amount || 0).toLocaleString()}</span>
                                <span className={isPaid ? "text-green-600" : isPartial ? "text-amber-600" : "text-destructive"}>
                                  • {isPaid ? "Paid" : isPartial ? `₹${(q.paid_amount || 0).toLocaleString()} paid` : "Pending"}
                                </span>
                              </div>
                            </div>
                          </div>
                          {q.file_path && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownloadInvoice(q.file_path!, q.file_name || "invoice.pdf")}>
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No invoices</p>
                )}
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
