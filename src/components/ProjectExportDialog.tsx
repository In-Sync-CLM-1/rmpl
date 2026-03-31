import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, X, AlertCircle, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProjectExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: {
    searchQuery: string;
    statusFilter: string;
    dateFilter: string;
    userFilter: string;
  };
  totalCount: number;
}

const BATCH_SIZE = 1000;

const EXPORT_COLUMNS = [
  "project_number",
  "project_name",
  "project_type",
  "client_id",
  "contact_id",
  "status",
  "project_source",
  "referrer_name",
  "campaign_type",
  "project_value",
  "management_fees",
  "expected_afactor",
  "final_afactor",
  "number_of_attendees",
  "brief",
  "closed_reason",
  "lost_reason",
  "created_at",
  "updated_at",
  "invoiced_closed_at",
];

const HEADER_LABELS: Record<string, string> = {
  project_number: "Project Number",
  project_name: "Project Name",
  project_type: "Project Type",
  client_id: "Client",
  contact_id: "Contact",
  status: "Status",
  project_owner: "Project Owner",
  created_by: "Created By",
  project_source: "Project Source",
  referrer_name: "Referrer",
  campaign_type: "Campaign Type",
  project_value: "Project Value",
  management_fees: "Management Fees",
  expected_afactor: "Expected A-Factor",
  final_afactor: "Final A-Factor",
  number_of_attendees: "Number of Attendees",
  brief: "Brief",
  closed_reason: "Closed Reason",
  lost_reason: "Lost Reason",
  locations: "Locations",
  event_dates: "Event Dates",
  team_members: "Team Members",
  created_at: "Created Date",
  updated_at: "Updated Date",
  invoiced_closed_at: "Invoiced/Closed Date",
};

const STATUS_LABELS: Record<string, string> = {
  pitched: "Pitched",
  in_discussion: "In Discussion",
  estimate_shared: "Estimate Shared",
  po_received: "PO Received",
  execution: "Execution",
  invoiced: "Invoiced",
};

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatLocations(locations: any): string {
  if (!Array.isArray(locations) || locations.length === 0) return "";
  return locations
    .map((loc: any) => `${loc.city || ""}${loc.venue ? ` - ${loc.venue}` : ""}`)
    .join("; ");
}

function formatEventDates(dates: any): string {
  if (!Array.isArray(dates) || dates.length === 0) return "";
  return dates
    .map((d: any) => {
      const dateStr = d.date ? new Date(d.date).toLocaleDateString() : "";
      const type = d.type === "first_half" ? " (1st Half)" : d.type === "second_half" ? " (2nd Half)" : "";
      return `${dateStr}${type}`;
    })
    .join("; ");
}

export function ProjectExportDialog({
  open,
  onOpenChange,
  filters,
  totalCount,
}: ProjectExportDialogProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedRecords, setProcessedRecords] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const buildQuery = () => {
    let query = supabase
      .from("projects")
      .select(
        `id,${EXPORT_COLUMNS.join(",")},project_owner,created_by,locations,event_dates`,
        { count: "exact" }
      );

    if (filters.searchQuery) {
      const words = filters.searchQuery.trim().split(/\s+/).filter(Boolean);
      if (words.length === 1) {
        query = query.or(`project_name.ilike.%${words[0]}%,project_number.ilike.%${words[0]}%,client_id.ilike.%${words[0]}%`);
      } else {
        for (const word of words) {
          query = query.ilike("project_name", `%${word}%`);
        }
      }
    }

    if (filters.statusFilter && filters.statusFilter !== "all") {
      query = query.eq("status", filters.statusFilter);
    }

    if (filters.dateFilter && filters.dateFilter !== "all") {
      const now = new Date();
      let startDate: Date;
      switch (filters.dateFilter) {
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
      query = query.gte("created_at", startDate.toISOString());
    }

    if (filters.userFilter && filters.userFilter !== "all") {
      query = query.or(`created_by.eq.${filters.userFilter},project_owner.eq.${filters.userFilter}`);
    }

    return query.order("created_at", { ascending: false });
  };

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(0);
    setProcessedRecords(0);
    setError(null);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Get count
      const { count, error: countError } = await buildQuery();
      if (countError) throw countError;

      const total = count || 0;
      setTotalRecords(total);

      if (total === 0) {
        toast.info("No projects to export");
        setIsExporting(false);
        return;
      }

      const totalBatches = Math.ceil(total / BATCH_SIZE);
      let allData: any[] = [];

      // Fetch user names for owner/creator resolution
      const { data: profiles } = await supabase.from("profiles").select("id, full_name");
      const userMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => {
        if (p.id) userMap[p.id] = p.full_name || "Unknown";
      });

      for (let batch = 0; batch < totalBatches; batch++) {
        if (controller.signal.aborted) throw new Error("Export cancelled");

        const offset = batch * BATCH_SIZE;
        const { data, error: fetchError } = await buildQuery().range(offset, offset + BATCH_SIZE - 1);
        if (fetchError) throw fetchError;

        if (data) allData = allData.concat(data);

        const processed = Math.min((batch + 1) * BATCH_SIZE, total);
        setProcessedRecords(processed);
        setProgress(Math.round((processed / total) * 100));

        if (batch < totalBatches - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Fetch team members separately (no FK to profiles in schema)
      const projectIds = allData.map((p: any) => p.id || p.project_number).filter(Boolean);
      const teamMembersMap: Record<string, any[]> = {};
      if (projectIds.length > 0) {
        // Fetch in batches of 500 to avoid query size limits
        for (let i = 0; i < allData.length; i += 500) {
          const batchIds = allData.slice(i, i + 500).map((p: any) => p.id).filter(Boolean);
          if (batchIds.length === 0) continue;
          const { data: tmData } = await supabase
            .from("project_team_members")
            .select("project_id, user_id, role_in_project")
            .in("project_id", batchIds);
          (tmData || []).forEach((m: any) => {
            if (!teamMembersMap[m.project_id]) teamMembersMap[m.project_id] = [];
            teamMembersMap[m.project_id].push(m);
          });
        }
      }

      // Build CSV
      const allHeaders = [
        ...EXPORT_COLUMNS,
        "project_owner",
        "created_by",
        "locations",
        "event_dates",
        "team_members",
      ];
      const headerRow = allHeaders.map((h) => HEADER_LABELS[h] || h).join(",");

      const rows = allData.map((row) => {
        return allHeaders
          .map((col) => {
            if (col === "project_owner" || col === "created_by") {
              return escapeCSV(userMap[row[col]] || "");
            }
            if (col === "status") {
              return escapeCSV(STATUS_LABELS[row[col]] || row[col]);
            }
            if (col === "locations") {
              return escapeCSV(formatLocations(row.locations));
            }
            if (col === "event_dates") {
              return escapeCSV(formatEventDates(row.event_dates));
            }
            if (col === "team_members") {
              const members = teamMembersMap[row.id] || [];
              return escapeCSV(
                members
                  .map((m: any) => {
                    const name = userMap[m.user_id] || "Unknown";
                    const role = m.role_in_project || "";
                    return role ? `${name} (${role})` : name;
                  })
                  .join("; ")
              );
            }
            if (col === "created_at" || col === "updated_at" || col === "invoiced_closed_at") {
              return escapeCSV(row[col] ? new Date(row[col]).toLocaleDateString() : "");
            }
            return escapeCSV(row[col]);
          })
          .join(",");
      });

      const csv = [headerRow, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `projects-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${allData.length.toLocaleString()} projects successfully`);
      onOpenChange(false);
    } catch (err: any) {
      if (err.message === "Export cancelled") {
        toast.info("Export cancelled");
      } else {
        console.error("Export error:", err);
        setError(err.message || "Export failed");
        toast.error("Export failed: " + (err.message || "Unknown error"));
      }
    } finally {
      setIsExporting(false);
      setAbortController(null);
    }
  };

  const handleCancel = () => {
    if (abortController) abortController.abort();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Projects
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-md">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {isExporting ? (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Exporting projects... {processedRecords.toLocaleString()} / {totalRecords.toLocaleString()}
              </div>
              <Progress value={progress} className="h-2" />
              <div className="text-xs text-muted-foreground text-center">{progress}% complete</div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg border">
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{totalCount.toLocaleString()} projects</p>
                  <p className="text-xs text-muted-foreground">
                    will be exported based on your current filters
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Includes project details, team members, locations, and event dates. Data will be exported as CSV.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            <X className="h-4 w-4 mr-2" />
            {isExporting ? "Cancel" : "Close"}
          </Button>
          {!isExporting && (
            <Button onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Start Export
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
