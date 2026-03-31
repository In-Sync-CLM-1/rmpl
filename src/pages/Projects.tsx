import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Plus, FolderKanban, Search, X, Upload, Download } from "lucide-react";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { useCrudMutation } from "@/hooks/useCrudMutation";
import { DataTable, DataTableColumn } from "@/components/data-table/DataTable";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useQuery } from "@tanstack/react-query";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { ProjectExportDialog } from "@/components/ProjectExportDialog";

const PROJECT_TYPE_LABELS: Record<string, string> = {
  integrated: "Integrated",
  mice: "MICE",
  digital_creatives: "Digital/Creatives",
  telecalling: "Telecalling",
  data_services: "Data Services",
  logistics_gifts: "Logistics/Gifts",
};

interface Project {
  id: string;
  project_number: string;
  project_name: string;
  project_type: string | null;
  status: string;
  client_id: string | null;
  client_name?: string | null;
  locations: any[];
  event_dates: any[];
  project_team_members?: { id: string }[];
  created_at: string;
  created_by?: string;
  creator_full_name?: string | null;
  project_owner?: string | null;
  owner_full_name?: string | null;
}

export default function Projects() {
  const navigate = useNavigate();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("year");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Fetch all users for filter dropdown
  const { data: allUsers } = useQuery({
    queryKey: ["users-for-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const {
    data: projects,
    totalCount,
    totalPages,
    currentPage,
    itemsPerPage,
    isLoading,
    refetch,
    handlePageChange,
    handleItemsPerPageChange,
  } = usePaginatedQuery<Project>({
    queryKey: ["projects", searchQuery, statusFilter, typeFilter, dateFilter, userFilter],
    queryFn: async (from, to) => {
      let query = supabase
        .from("projects")
        .select(
          `
          *,
          project_team_members (
            id
          )
        `,
          { count: "exact" }
        );

      // Apply search filter - search in project_name, project_number, and client_id
      // Split search into words so each word is matched independently (handles word order differences)
      if (searchQuery) {
        const words = searchQuery.trim().split(/\s+/).filter(Boolean);
        if (words.length === 1) {
          query = query.or(`project_name.ilike.%${words[0]}%,project_number.ilike.%${words[0]}%,client_id.ilike.%${words[0]}%`);
        } else {
          // Each word must appear in the project name (AND logic across words)
          for (const word of words) {
            query = query.ilike('project_name', `%${word}%`);
          }
        }
      }

      // Apply status filter
      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      // Apply type filter
      if (typeFilter && typeFilter !== "all") {
        query = query.eq("project_type", typeFilter);
      }

      // Apply date filter
      if (dateFilter && dateFilter !== "all") {
        const now = new Date();
        let startDate: Date;
        
        switch (dateFilter) {
          case "today":
            startDate = new Date(now.setHours(0, 0, 0, 0));
            break;
          case "week":
            startDate = new Date(now.setDate(now.getDate() - 7));
            break;
          case "month":
            startDate = new Date(now.setMonth(now.getMonth() - 1));
            break;
          case "quarter":
            startDate = new Date(now.setMonth(now.getMonth() - 3));
            break;
          case "year":
            startDate = new Date(now.setFullYear(now.getFullYear() - 1));
            break;
          default:
            startDate = new Date(0);
        }
        
        if (dateFilter !== "all") {
          query = query.gte("created_at", startDate.toISOString());
        }
      }

      // Apply user filter — match created_by, project_owner, OR team membership
      if (userFilter && userFilter !== "all") {
        // First get project IDs where this user is a team member
        const { data: memberProjects } = await supabase
          .from("project_team_members")
          .select("project_id")
          .eq("user_id", userFilter);

        const memberProjectIds = (memberProjects || []).map(m => m.project_id);

        if (memberProjectIds.length > 0) {
          query = query.or(`created_by.eq.${userFilter},project_owner.eq.${userFilter},id.in.(${memberProjectIds.join(",")})`);
        } else {
          query = query.or(`created_by.eq.${userFilter},project_owner.eq.${userFilter}`);
        }
      }

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        return { data: null, count, error };
      }

      const baseProjects = (data || []) as any[];
      const userIds = Array.from(
        new Set(
          baseProjects
            .flatMap((p) => [p.created_by, p.project_owner])
            .filter((id): id is string => !!id)
        )
      );

      let userMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);

        (profilesData || []).forEach((p: any) => {
          if (p.id) userMap[p.id] = p.full_name;
        });
      }

      // Resolve client_id UUIDs to company names
      const clientIds = Array.from(
        new Set(
          baseProjects
            .map((p) => p.client_id)
            .filter((id): id is string => !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
        )
      );

      let clientMap: Record<string, string> = {};
      if (clientIds.length > 0) {
        const { data: clientsData } = await supabase
          .from("clients")
          .select("id, company_name")
          .in("id", clientIds);

        (clientsData || []).forEach((c: any) => {
          if (c.id) clientMap[c.id] = c.company_name;
        });
      }

      const enrichedProjects: Project[] = baseProjects.map((p) => ({
        ...p,
        creator_full_name: p.created_by ? userMap[p.created_by] || null : null,
        owner_full_name: p.project_owner ? userMap[p.project_owner] || null : null,
        client_name: p.client_id ? clientMap[p.client_id] || p.client_id : null,
      }));

      return { data: enrichedProjects, count, error: null };
    },
  });

  const { permissions } = useUserPermissions();

  const { delete: deleteProject, isDeleting } = useCrudMutation<Project>({
    queryKey: ["projects"],
    createFn: async () => null as any,
    updateFn: async () => null as any,
    deleteFn: async (id) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    successMessages: {
      delete: "Project deleted successfully",
    },
    errorMessages: {
      delete: "Failed to delete project",
    },
  });

  const handleDelete = async () => {
    if (deleteId) {
      await deleteProject(deleteId);
      setDeleteId(null);
      setProjectToDelete(null);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
    setDateFilter("quarter");
    setUserFilter("all");
  };

  const hasActiveFilters = searchQuery || statusFilter !== "all" || typeFilter !== "all" || dateFilter !== "all" || userFilter !== "all";

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      pitched: "secondary",
      in_discussion: "secondary",
      estimate_shared: "default",
      po_received: "default",
      execution: "default",
      invoiced: "outline",
      closed: "outline",
      lost: "destructive",
    };
    const labels: Record<string, string> = {
      pitched: "Pitched",
      in_discussion: "In Discussion",
      estimate_shared: "Estimate Shared",
      po_received: "PO Received",
      execution: "Execution",
      invoiced: "Invoiced",
      closed: "Closed",
      lost: "Lost",
    };
    return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
  };

  const columns: DataTableColumn<Project>[] = [
    {
      header: "Project #",
      cell: (project) => (
        <span className="font-mono font-semibold text-primary">
          {project.project_number}
        </span>
      ),
    },
    {
      header: "Project Name",
      cell: (project) => <span className="font-medium">{project.project_name}</span>,
    },
    {
      header: "Type",
      cell: (project) => project.project_type ? (
        <Badge variant="outline">{PROJECT_TYPE_LABELS[project.project_type] || project.project_type}</Badge>
      ) : "—",
    },
    {
      header: "Client",
      cell: (project) => project.client_name || "N/A",
    },
    {
      header: "Created Date",
      cell: (project) => new Date(project.created_at).toLocaleDateString(),
    },
    {
      header: "Project Owner",
      cell: (project) => project.owner_full_name || "N/A",
    },
    {
      header: "Location(s)",
      cell: (project) => {
        const locs = Array.isArray(project.locations) ? project.locations : [];
        if (locs.length === 0) return "N/A";
        if (locs.length === 1) {
          const loc = locs[0];
          return `${loc.city}${loc.venue ? ` - ${loc.venue}` : ""}`;
        }
        return `${locs.length} locations`;
      },
    },
    {
      header: "Team Size",
      cell: (project) => `${project.project_team_members?.length || 0} member(s)`,
    },
    {
      header: "Event Dates",
      cell: (project) => {
        const dates = Array.isArray(project.event_dates) ? project.event_dates : [];
        if (dates.length === 0) return "N/A";
        if (dates.length === 1) {
          const d = dates[0];
          const typeLabel =
            d.type === "full_day"
              ? ""
              : d.type === "first_half"
              ? " (1st Half)"
              : " (2nd Half)";
          return `${new Date(d.date).toLocaleDateString()}${typeLabel}`;
        }
        return `${dates.length} dates`;
      },
    },
    {
      header: "Status",
      cell: (project) => getStatusBadge(project.status),
    },
  ];

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold">Projects</h1>
            <p className="text-muted-foreground mt-1">
              Manage project details, teams, files, and quotations
            </p>
          </div>
          <div className="flex gap-2">
            {permissions.canExportProjects && (
              <Button variant="outline" onClick={() => setShowExport(true)}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowBulkImport(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Bulk Import
            </Button>
            <Button onClick={() => navigate("/projects/new")}>
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-card rounded-lg border p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {/* Search Filter */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pitched">Pitched</SelectItem>
                <SelectItem value="in_discussion">In Discussion</SelectItem>
                <SelectItem value="estimate_shared">Estimate Shared</SelectItem>
                <SelectItem value="po_received">PO Received</SelectItem>
                <SelectItem value="execution">Execution</SelectItem>
                <SelectItem value="invoiced">Invoiced</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Range Filter */}
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last Month</SelectItem>
                <SelectItem value="quarter">Last 3 Months</SelectItem>
                <SelectItem value="year">Last Year</SelectItem>
              </SelectContent>
            </Select>

            {/* User Filter */}
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {allUsers?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name || "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Reset Filters Button */}
            <Button
              variant="outline"
              onClick={handleResetFilters}
              disabled={!hasActiveFilters}
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Reset Filters
            </Button>
          </div>
        </div>

        <DataTable
          data={projects}
          columns={columns}
          isLoading={isLoading}
          getRowKey={(project) => project.id}
          emptyState={{
            icon: FolderKanban,
            title: "No projects found",
            description: "Get started by creating your first project",
            actionLabel: "New Project",
            onAction: () => navigate("/projects/new"),
          }}
          pagination={{
            currentPage,
            totalPages,
            totalItems: totalCount,
            itemsPerPage,
            onPageChange: handlePageChange,
            onItemsPerPageChange: handleItemsPerPageChange,
          }}
          onRowClick={(project) => navigate(`/projects/view/${project.id}`)}
          actions={(project) => (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/projects/edit/${project.id}`);
                }}
                title="Edit project"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {permissions.canDeleteProjects && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteId(project.id);
                    setProjectToDelete(project);
                  }}
                  title="Delete project (Admin only)"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        />
      </div>

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null);
            setProjectToDelete(null);
          }
        }}
        onConfirm={handleDelete}
        itemName={projectToDelete?.project_name}
        isLoading={isDeleting}
      />

      {permissions.canExportProjects && (
        <ProjectExportDialog
          open={showExport}
          onOpenChange={setShowExport}
          filters={{ searchQuery, statusFilter, dateFilter, userFilter }}
          totalCount={totalCount}
        />
      )}

      <BulkImportDialog
        open={showBulkImport}
        onOpenChange={setShowBulkImport}
        tableName="projects"
        tableLabel="Projects"
        requiredColumns={["Project Number", "Project Name", "Project Owner Email", "Team Member Email"]}
        templateColumns={[
          "Project Number",
          "Project Name",
          "Project Owner Email",
          "Team Member Email",
          "Team Member Role (owner/member/lead/coordinator)",
          "Client Name",
          "Contact Name",
          "City",
          "Venue",
          "Event Date (YYYY-MM-DD or M/D/YYYY)",
          "Event Type (full_day/first_half/second_half)",
          "Project Source (inbound/outbound/reference)",
          "Project Value",
          "Management Fees",
          "Expected A-Factor",
          "Final A-Factor",
          "Status (pitched/in_discussion/estimate_shared/po_received/execution/invoiced)",
          "Closed Reason",
          "Lost Reason",
          "Brief"
        ]}
        onImportComplete={() => refetch()}
      />
    </div>
  );
}
