import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, RefreshCw, Clock, Database, History, Search, CheckSquare } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

const ALL_TABLES = [
  'auth_users',
  'attendance_policies', 'attendance_records', 'attendance_regularizations',
  'backup_history', 'bulk_import_history', 'bulk_import_records',
  'call_dispositions', 'call_logs',
  'campaign_links', 'campaign_recipients', 'campaigns',
  'chat_conversations', 'chat_message_reactions', 'chat_messages', 'chat_participants',
  'clients', 'company_holidays',

  'csbd_credit_allocations', 'csbd_projection_audit', 'csbd_projections', 'csbd_targets',
  'demandcom', 'demandcom_backup_swap_20250129', 'demandcom_daily_performance',
  'demandcom_daily_targets', 'demandcom_field_changes', 'demandcom_pipeline',
  'designations', 'email_activity_log', 'email_templates',
  'employee_documents', 'employee_personal_details', 'employee_salary_details',
  'events', 'exotel_config', 'export_batches', 'export_jobs',
  'feature_announcements',
  'hr_policy_documents',
  'import_batches', 'import_staging',
  'inventory_allocations', 'inventory_audit_log', 'inventory_items',
  'jobs',
  'late_coming_records', 'leave_applications', 'leave_balance_adjustments', 'leave_balances',
  'monthly_point_summaries',
  'navigation_items', 'navigation_sections', 'notifications',
  'onboarding_documents', 'onboarding_forms', 'onboarding_otp_verifications',
  'onboarding_steps', 'onboarding_submissions', 'onboarding_tours',
  'operations_inventory_distribution', 'organizations',
  'password_reset_logs', 'payment_proof_images',
  'pipeline_stages', 'point_activity_types', 'profiles',
  'project_checklists',
  'project_demandcom_allocations', 'project_files',
  'project_livecom_events',
  'project_quotations', 'project_team_members', 'project_team_notifications', 'projects',
  'push_subscriptions',
  'quotation_payments', 'role_metadata',
  'salary_slips',
  'sync_batches', 'sync_logs', 'sync_status',
  'tasks', 'team_members', 'teams',
  'user_announcement_views', 'user_daily_activity', 'user_designations',
  'user_oauth_tokens', 'user_onboarding_progress', 'user_optional_holiday_claims',
  'user_points', 'user_roles', 'user_view_permissions',
  'vapi_call_logs', 'vapi_scheduled_calls',
  'vendors',
  'webhook_connectors', 'webhook_logs',
  'whatsapp_messages', 'whatsapp_settings', 'whatsapp_templates',
];

const DataExport = () => {
  const [downloadingTable, setDownloadingTable] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);

  const { data: backupHistory, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ["backup-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backup_history")
        .select("*")
        .order("completed_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const handleDownloadTable = async (tableName: string) => {
    setDownloadingTable(tableName);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("You must be logged in to export data");
        return;
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-backup?table=${tableName}&mode=full`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `Export failed with status ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      const fileName = `${tableName}_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;

      if (contentType.includes("text/csv")) {
        const blob = await response.blob();
        downloadBlob(blob, fileName);
      } else {
        // JSON response — extract the table's CSV
        const json = await response.json();
        if (json.data?.[tableName]?.csv) {
          downloadCSV(json.data[tableName].csv, fileName);
        } else {
          throw new Error("No data returned for table");
        }
      }

      toast.success(`Downloaded ${tableName}`);
      refetchHistory();
    } catch (err: any) {
      console.error("Export error:", err);
      toast.error(err.message || "Export failed");
    } finally {
      setDownloadingTable(null);
    }
  };

  const downloadCSV = (csvString: string, fileName: string) => {
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, fileName);
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredTables = ALL_TABLES.filter(t =>
    t.toLowerCase().includes(search.toLowerCase())
  );

  const allFilteredSelected = filteredTables.length > 0 && filteredTables.every(t => selectedTables.has(t));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const next = new Set(selectedTables);
      filteredTables.forEach(t => next.delete(t));
      setSelectedTables(next);
    } else {
      const next = new Set(selectedTables);
      filteredTables.forEach(t => next.add(t));
      setSelectedTables(next);
    }
  };

  const toggleTable = (table: string) => {
    const next = new Set(selectedTables);
    if (next.has(table)) next.delete(table);
    else next.add(table);
    setSelectedTables(next);
  };

  const handleBulkDownload = async () => {
    if (selectedTables.size === 0) return;
    setIsBulkDownloading(true);
    let successCount = 0;
    let failCount = 0;
    for (const table of Array.from(selectedTables)) {
      try {
        await handleDownloadTable(table);
        successCount++;
      } catch {
        failCount++;
      }
    }
    setIsBulkDownloading(false);
    if (failCount > 0) {
      toast.warning(`Downloaded ${successCount} tables, ${failCount} failed`);
    } else {
      toast.success(`Downloaded ${successCount} tables`);
    }
  };

  return (
    <div className="space-y-6 px-4 md:px-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Export</h1>
        <p className="text-muted-foreground">Download individual tables as CSV files.</p>
      </div>

      {/* Table List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Tables ({filteredTables.length})
          </CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tables..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {selectedTables.size > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <Button
                onClick={handleBulkDownload}
                disabled={isBulkDownloading || downloadingTable !== null}
                size="sm"
              >
                {isBulkDownloading ? (
                  <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Downloading...</>
                ) : (
                  <><Download className="mr-2 h-4 w-4" /> Download Selected ({selectedTables.size})</>
                )}
              </Button>
            </div>
          )}
          <div className="overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Table Name</TableHead>
                  <TableHead className="w-[120px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTables.map((table) => (
                  <TableRow key={table}>
                    <TableCell>
                      <Checkbox
                        checked={selectedTables.has(table)}
                        onCheckedChange={() => toggleTable(table)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">{table}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadTable(table)}
                        disabled={downloadingTable !== null || isBulkDownloading}
                      >
                        {downloadingTable === table ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Export History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !backupHistory?.length ? (
            <p className="text-sm text-muted-foreground">No exports yet.</p>
          ) : (
            <div className="overflow-auto max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Tables</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backupHistory.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(b.completed_at), "dd MMM yyyy, hh:mm a")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={b.backup_mode === "full" ? "default" : "secondary"}>
                          {b.backup_mode}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{b.tables_exported?.length ?? 0}</TableCell>
                      <TableCell className="text-sm">{b.total_rows_exported?.toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {b.notes || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DataExport;