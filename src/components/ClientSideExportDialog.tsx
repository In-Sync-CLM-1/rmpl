import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, X, AlertCircle, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MasterFilters {
  activity_name: string[];
  turnover: string[];
  emp_size: string[];
  industry_type: string[];
  sub_industry: string[];
  city: string[];
  state: string[];
  job_level_updated: string[];
  deppt: string[];
}

export interface DemandComFilters {
  nameEmail: string;
  city: string;
  activityName: string;
  assignedTo: string;
  disposition: string[];
  subdisposition: string[];
}

interface ClientSideExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName: "demandcom";
  filenamePrefix: string;
  columns?: string[];
  filters?: MasterFilters | DemandComFilters;
  filteredCount?: number;
}

const BATCH_SIZE = 1000;
const USER_COLUMNS = ["created_by", "assigned_to", "assigned_by", "updated_by"];

// Standardized export columns matching import template (37 fields)
// Excludes tracking fields (latest_disposition, remarks, etc.) to ensure re-import compatibility
const STANDARD_EXPORT_COLUMNS = [
  'name',
  'mobile_numb',
  'assigned_to',
  'mobile2',
  'official',
  'personal_email_id',
  'generic_email_id',
  'linkedin',
  'designation',
  'deppt',
  'job_level_updated',
  'company_name',
  'industry_type',
  'sub_industry',
  'website',
  'emp_size',
  'turnover',
  'erp_name',
  'erp_vendor',
  'address',
  'location',
  'city',
  'state',
  'zone',
  'tier',
  'pincode',
  'activity_name',
  'country',
  'source',
  'source_1',
  'extra',
  'extra_1',
  'extra_2',
  'user_id',
  'salutation',
  'turnover_link',
  'company_linkedin_url',
  'associated_member_linkedin',
  'latest_disposition',
  'latest_subdisposition',
  'updated_at',
  'assigned_by',
];

export function ClientSideExportDialog({
  open,
  onOpenChange,
  tableName,
  filenamePrefix,
  columns,
  filters,
  filteredCount,
}: ClientSideExportDialogProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedRecords, setProcessedRecords] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const escapeCSVValue = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const fetchUserMap = async (data: any[]): Promise<Record<string, string>> => {
    const userIds = new Set<string>();
    data.forEach(row => {
      USER_COLUMNS.forEach(col => {
        if (row[col] && typeof row[col] === "string") {
          userIds.add(row[col]);
        }
      });
    });

    if (userIds.size === 0) return {};

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", Array.from(userIds));

    if (error || !profiles) return {};

    return Object.fromEntries(
      profiles.map(p => [p.id, p.full_name || "Unknown"])
    );
  };

  const isMasterFilters = (f: MasterFilters | DemandComFilters): f is MasterFilters => {
    return 'activity_name' in f && Array.isArray(f.activity_name);
  };

  const isDemandComFilters = (f: MasterFilters | DemandComFilters): f is DemandComFilters => {
    return 'nameEmail' in f;
  };

  const buildFilteredQuery = () => {
    // Use standardized columns for consistent export format matching import template
    const exportColumns = columns || STANDARD_EXPORT_COLUMNS;
    let query = supabase
      .from("demandcom" as any)
      .select(exportColumns.join(","), { count: "exact" })
      .order("mobile_numb");

    if (filters && isMasterFilters(filters)) {
      if (filters.activity_name.length > 0) {
        query = query.in("activity_name", filters.activity_name);
      }
      if (filters.turnover.length > 0) {
        query = query.in("turnover", filters.turnover);
      }
      if (filters.emp_size.length > 0) {
        query = query.in("emp_size", filters.emp_size);
      }
      if (filters.industry_type.length > 0) {
        query = query.in("industry_type", filters.industry_type);
      }
      if (filters.sub_industry.length > 0) {
        query = query.in("sub_industry", filters.sub_industry);
      }
      if (filters.city.length > 0) {
        query = query.in("city", filters.city);
      }
      if (filters.state.length > 0) {
        query = query.in("state", filters.state);
      }
      if (filters.job_level_updated.length > 0) {
        query = query.in("job_level_updated", filters.job_level_updated);
      }
      if (filters.deppt.length > 0) {
        query = query.in("deppt", filters.deppt);
      }
    } else if (filters && isDemandComFilters(filters)) {
      // Check if any filters are applied
      const hasFilters = filters.nameEmail || filters.city || filters.activityName || 
                         filters.assignedTo || filters.disposition.length > 0 ||
                         filters.subdisposition.length > 0;
      
      // Default: Show records from last 30 days only if no filters
      if (!hasFilters) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        query = query.gte("created_at", thirtyDaysAgo.toISOString());
      }

      if (filters.nameEmail) {
        const filterPattern = `%${filters.nameEmail}%`;
        const orFilter = `name.ilike.${filterPattern},personal_email_id.ilike.${filterPattern},generic_email_id.ilike.${filterPattern},mobile_numb.ilike.${filterPattern}`;
        query = query.or(orFilter);
      }

      if (filters.city) {
        query = query.ilike("city", `%${filters.city}%`);
      }

      if (filters.activityName) {
        query = query.ilike("activity_name", `%${filters.activityName}%`);
      }

      if (filters.assignedTo && filters.assignedTo !== "all") {
        if (filters.assignedTo === "unassigned") {
          query = query.is("assigned_to", null);
        } else {
          query = query.eq("assigned_to", filters.assignedTo);
        }
      }

      if (filters.disposition.length > 0) {
        query = query.in("latest_disposition", filters.disposition);
      }

      if (filters.subdisposition.length > 0) {
        query = query.in("latest_subdisposition", filters.subdisposition);
      }
    }

    return query;
  };

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(0);
    setProcessedRecords(0);
    setError(null);
    
    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Get count with filters applied
      const countQuery = buildFilteredQuery();
      const { count, error: countError } = await countQuery;

      if (countError) throw countError;
      
      const total = count || 0;
      setTotalRecords(total);

      if (total === 0) {
        toast.info("No records to export");
        setIsExporting(false);
        return;
      }

      const totalBatches = Math.ceil(total / BATCH_SIZE);
      let allData: any[] = [];
      let headers: string[] = [];

      // Fetch data in batches with filters
      for (let batch = 0; batch < totalBatches; batch++) {
        if (controller.signal.aborted) {
          throw new Error("Export cancelled");
        }

        const offset = batch * BATCH_SIZE;
        const remainingRecords = total - (batch * BATCH_SIZE);
        const batchLimit = Math.min(BATCH_SIZE, remainingRecords);
        
        const query = buildFilteredQuery();
        const { data, error: fetchError } = await query.range(offset, offset + batchLimit - 1);

        if (fetchError) throw fetchError;

        if (data && Array.isArray(data) && data.length > 0) {
          // Get headers from first batch
          if (batch === 0 && typeof data[0] === 'object' && data[0] !== null) {
            headers = Object.keys(data[0]);
          }

          allData = allData.concat(data);
        }

        const processed = Math.min((batch + 1) * BATCH_SIZE, total);
        setProcessedRecords(processed);
        setProgress(Math.round((processed / total) * 100));

        // Small delay to prevent overwhelming the database
        if (batch < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Fetch user lookup map for resolving UUIDs to names
      const userMap = await fetchUserMap(allData);

      // Build CSV with user names resolved
      const csvRows = [headers.join(",")];
      for (const row of allData) {
        const values = headers.map(header => {
          let value = row[header];
          // Replace UUID with user name for user columns
          if (USER_COLUMNS.includes(header) && value && userMap[value]) {
            value = userMap[value];
          }
          return escapeCSVValue(value);
        });
        csvRows.push(values.join(","));
      }

      const csvContent = csvRows.join("\n");
      
      // Create download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filenamePrefix}-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${allData.length.toLocaleString()} records successfully`);
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
    if (abortController) {
      abortController.abort();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Data
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
                Exporting records... {processedRecords.toLocaleString()} / {totalRecords.toLocaleString()}
              </div>
              <Progress value={progress} className="h-2" />
              <div className="text-xs text-muted-foreground text-center">
                {progress}% complete
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg border">
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {(filteredCount ?? 0).toLocaleString()} records
                  </p>
                  <p className="text-xs text-muted-foreground">
                    will be exported based on your current filters
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Data will be exported directly to your browser as CSV.
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
