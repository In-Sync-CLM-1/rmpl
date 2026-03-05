import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Download, X, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExportOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalRecords: number;
  exportEndpoint: string;
  filenamePrefix: string;
}

interface PendingExport {
  id: string;
  current_batch: number;
  processed_records: number;
  total_records: number;
  status: string;
}

export function ExportOptionsDialog({
  open,
  onOpenChange,
  totalRecords,
  exportEndpoint,
  filenamePrefix,
}: ExportOptionsDialogProps) {
  const [exportType, setExportType] = useState<"all" | "partial">("all");
  const [recordLimit, setRecordLimit] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [pendingExport, setPendingExport] = useState<PendingExport | null>(null);
  const cancelledRef = useRef(false);
  const jobIdRef = useRef<string | null>(null);

  // Check for pending exports on open
  useEffect(() => {
    if (open) {
      checkPendingExport();
    }
  }, [open]);

  const checkPendingExport = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('export_jobs')
        .select('id, current_batch, processed_records, total_records, status')
        .eq('user_id', user.id)
        .eq('source', 'master')
        .in('status', ['processing', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setPendingExport(data);
      }
    } catch {
      // No pending export
    }
  };

  const resumeExport = async () => {
    if (!pendingExport) return;

    try {
      setIsExporting(true);
      cancelledRef.current = false;
      jobIdRef.current = pendingExport.id;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in");
        setIsExporting(false);
        return;
      }

      // Get the last processed ID from storage files
      const { data: files } = await supabase.storage
        .from('exports')
        .list(`temp/${pendingExport.id}`, { sortBy: { column: 'name', order: 'desc' }, limit: 1 });

      let lastBatch = pendingExport.current_batch || 0;
      let lastId: string | null = null;

      // If we have files, we need to get the lastId from the job
      // For now, start from where we left off
      setStatusText(`Resuming from batch ${lastBatch + 1}...`);
      setProgress(Math.round((pendingExport.processed_records / pendingExport.total_records) * 85));

      // Supabase has HARD 1000 row limit
      await processBatches(
        pendingExport.id, 
        Math.ceil(pendingExport.total_records / 1000),
        session.access_token,
        lastBatch,
        lastId
      );

      setPendingExport(null);
    } catch (err: any) {
      console.error('Resume error:', err);
      toast.error(err.message || "Resume failed");
      setIsExporting(false);
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setProgress(0);
      setStatusText("Starting export...");
      cancelledRef.current = false;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in to export");
        setIsExporting(false);
        return;
      }

      const limit = exportType === "partial" && recordLimit 
        ? parseInt(recordLimit, 10) 
        : undefined;

      if (exportType === "partial" && (!limit || limit <= 0)) {
        toast.error("Enter a valid number");
        setIsExporting(false);
        return;
      }

      // Start export
      const { data, error } = await supabase.functions.invoke(exportEndpoint, {
        body: { limit }
      });

      if (error) throw error;

      // Check if direct CSV (small export)
      if (typeof data === 'string') {
        downloadBlob(new Blob([data], { type: 'text/csv' }));
        toast.success("Export complete");
        handleClose();
        return;
      }

      // Large export - frontend-driven batching
      if (data.exportJobId) {
        jobIdRef.current = data.exportJobId;
        await processBatches(data.exportJobId, data.totalBatches, session.access_token, 0, null);
      }

    } catch (err: any) {
      console.error('Export error:', err);
      toast.error(err.message || "Export failed");
      setIsExporting(false);
    }
  };

  const processBatches = async (
    jobId: string, 
    totalBatches: number, 
    token: string,
    startBatch: number = 0,
    startLastId: string | null = null
  ) => {
    let currentBatch = startBatch;
    let consecutiveErrors = 0;
    let lastId: string | null = startLastId;
    const estimatedBatches = Math.ceil(totalBatches);

    const invokeWithRetry = async (body: any, retries = 5): Promise<any> => {
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const { data, error } = await supabase.functions.invoke('process-export-batch', {
            body
          });
          
          if (error) throw error;
          return data;
        } catch (err: any) {
          console.warn(`Batch attempt ${attempt + 1} failed:`, err.message);
          if (attempt === retries - 1) throw err;
          // Longer backoff: 3s, 6s, 12s, 24s, 48s
          await new Promise(r => setTimeout(r, 3000 * Math.pow(2, attempt)));
        }
      }
    };

    while (!cancelledRef.current) {
      setStatusText(`Processing batch ${currentBatch + 1} of ~${estimatedBatches}...`);
      setProgress(Math.min(85, Math.round((currentBatch / Math.max(estimatedBatches, 1)) * 85)));

      try {
        const data = await invokeWithRetry({ jobId, batchNum: currentBatch, lastId });

        if (data.cancelled) {
          toast.info("Export cancelled");
          setIsExporting(false);
          return;
        }

        if (!data.success) throw new Error(data.message || 'Batch failed');

        consecutiveErrors = 0;
        currentBatch++;
        lastId = data.lastId;

        // Update progress display with actual numbers
        if (data.processedRecords && data.totalRecords) {
          const pct = Math.min(85, Math.round((data.processedRecords / data.totalRecords) * 85));
          setProgress(pct);
          setStatusText(`Processed ${data.processedRecords.toLocaleString()} of ${data.totalRecords.toLocaleString()}...`);
        }

        // Small delay between batches
        await new Promise(r => setTimeout(r, 200));

        if (data.isComplete) break;

      } catch (err: any) {
        console.error(`Batch ${currentBatch} error:`, err);
        consecutiveErrors++;

        if (consecutiveErrors >= 5) {
          // Save state for resume
          toast.error("Export paused due to network issues. You can resume it later.");
          setIsExporting(false);
          checkPendingExport();
          return;
        }

        // Wait before retry with longer backoff
        const waitTime = 5000 * consecutiveErrors;
        setStatusText(`Network issue, retrying in ${waitTime / 1000}s...`);
        await new Promise(r => setTimeout(r, waitTime));
      }
    }

    if (cancelledRef.current) return;

    // Assemble final file
    setStatusText("Assembling final file...");
    setProgress(90);

    const { data: assemblyResult, error: assemblyError } = await supabase.functions.invoke('assemble-export', {
      body: { jobId }
    });

    if (assemblyError) throw assemblyError;
    if (!assemblyResult?.success) throw new Error('Assembly failed');

    setProgress(100);
    setStatusText("Downloading...");

    // Download
    if (assemblyResult.fileUrl) {
      const link = document.createElement('a');
      link.href = assemblyResult.fileUrl;
      link.download = assemblyResult.fileName || `${filenamePrefix}-export.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    toast.success(`Exported ${assemblyResult.totalRecords?.toLocaleString()} records`);
    handleClose();
  };

  const handleCancel = async () => {
    cancelledRef.current = true;
    
    if (jobIdRef.current) {
      await supabase.from('export_jobs').update({ status: 'cancelled' }).eq('id', jobIdRef.current);
    }

    setIsExporting(false);
    setProgress(0);
    setStatusText("");
  };

  const handleClose = () => {
    if (isExporting) handleCancel();
    setExportType("all");
    setRecordLimit("");
    setProgress(0);
    setStatusText("");
    setIsExporting(false);
    setPendingExport(null);
    jobIdRef.current = null;
    onOpenChange(false);
  };

  const downloadBlob = (blob: Blob) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filenamePrefix}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const recordsToExport = exportType === "partial" && recordLimit 
    ? Math.min(parseInt(recordLimit, 10) || 0, totalRecords)
    : totalRecords;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Options</DialogTitle>
        </DialogHeader>

        {!isExporting ? (
          <div className="space-y-6 py-4">
            {pendingExport && (
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-3">
                <div className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Incomplete Export Found
                </div>
                <div className="text-sm text-amber-700 dark:text-amber-300">
                  {pendingExport.processed_records?.toLocaleString()} of {pendingExport.total_records?.toLocaleString()} records processed
                </div>
                <div className="flex gap-2">
                  <Button onClick={resumeExport} className="flex-1" variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Resume
                  </Button>
                  <Button 
                    onClick={async () => {
                      await supabase.from('export_jobs').update({ status: 'cancelled' }).eq('id', pendingExport.id);
                      setPendingExport(null);
                      toast.success("Stuck export cleared");
                    }} 
                    variant="destructive"
                    size="icon"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <Label className="text-sm text-muted-foreground">
              Available: {totalRecords.toLocaleString()} records
            </Label>

            <RadioGroup
              value={exportType}
              onValueChange={(v) => setExportType(v as "all" | "partial")}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="font-normal cursor-pointer">
                  Export all ({totalRecords.toLocaleString()})
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="partial" id="partial" />
                <Label htmlFor="partial" className="font-normal cursor-pointer">
                  Export specific number
                </Label>
              </div>
            </RadioGroup>

            {exportType === "partial" && (
              <div className="space-y-2 pl-6">
                <Label htmlFor="recordLimit">Number of records</Label>
                <Input
                  id="recordLimit"
                  type="number"
                  min={1}
                  max={totalRecords}
                  placeholder={`1 - ${totalRecords.toLocaleString()}`}
                  value={recordLimit}
                  onChange={(e) => setRecordLimit(e.target.value)}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-6">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="truncate flex-1">{statusText}</span>
                <span className="ml-2">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Export will pause automatically if network issues occur. You can resume later.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {isExporting ? (
            <Button variant="destructive" onClick={handleCancel} className="w-full">
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button 
                onClick={handleExport}
                disabled={exportType === "partial" && (!recordLimit || parseInt(recordLimit, 10) <= 0)}
              >
                <Download className="h-4 w-4 mr-2" />
                Export {recordsToExport.toLocaleString()}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
