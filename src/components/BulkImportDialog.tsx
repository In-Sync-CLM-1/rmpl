import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AlertCircle, CheckCircle, Clock, Download, Upload, X, RefreshCw } from "lucide-react";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CsvColumnMapper, DbColumn } from "./CsvColumnMapper";

const MAX_RECORDS = 500000;
const POLL_INTERVAL = 2000; // Poll every 2 seconds

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName: string;
  tableLabel: string;
  requiredColumns: string[];
  templateColumns: string[];
  onImportComplete?: () => void;
}

interface ImportHistory {
  id: string;
  file_name: string;
  status: string;
  total_records: number;
  successful_records: number;
  failed_records: number;
  created_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  can_revert: boolean;
  reverted_at: string | null;
}

export function BulkImportDialog({
  open,
  onOpenChange,
  tableName,
  tableLabel,
  requiredColumns,
  templateColumns,
  onImportComplete,
}: BulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [importId, setImportId] = useState<string | null>(null);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [updatedCount, setUpdatedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [importResult, setImportResult] = useState<any>(null);
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([]);
  const [showRevertDialog, setShowRevertDialog] = useState(false);
  const [revertImportId, setRevertImportId] = useState<string | null>(null);
  const [isReverting, setIsReverting] = useState(false);
  const [showColumnMapper, setShowColumnMapper] = useState(false);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [batchSize, setBatchSize] = useState(250);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchImportHistory();
    }
  }, [open]);

  const fetchImportHistory = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-import-history', {
        body: { tableName, limit: 3 }
      });

      if (error) throw error;
      setImportHistory(data?.imports || []);
    } catch (error) {
      console.error('Error fetching import history:', error);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = templateColumns.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tableName}_template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setValidationErrors([]);
    setImportResult(null);
    setShowColumnMapper(false);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        const errors: string[] = [];

        if (data.length === 0) {
          errors.push("CSV file is empty");
          setValidationErrors(errors);
          return;
        }

        if (data.length > MAX_RECORDS) {
          errors.push(`File contains ${data.length} rows. Maximum allowed: ${MAX_RECORDS}. Please split your file.`);
          setValidationErrors(errors);
          setParsedData([]);
          return;
        }

        const fileColumns = Object.keys(data[0] || {});
        setCsvHeaders(fileColumns);

        // Validate required columns for projects
        if (tableName === 'projects') {
          const missingColumns = requiredColumns.filter(
            (required) => !fileColumns.includes(required)
          );
          if (missingColumns.length > 0) {
            errors.push(
              `Missing required columns: ${missingColumns.join(", ")}. Please download the template and use the correct column names.`
            );
          }
          
          // Check for common template columns
          const expectedColumns = templateColumns.filter(col => 
            !col.includes('(') || col === 'Team Member Role (owner/member/lead/coordinator)'
          );
          const foundColumns = expectedColumns.filter(col => fileColumns.includes(col));
          
          if (foundColumns.length < 3) {
            errors.push(
              `Your CSV appears to have different column names. Please use the downloaded template with exact column names.`
            );
          }
        }

        // Basic validation - just check file isn't empty
        setValidationErrors(errors);
        if (errors.length === 0) {
          setParsedData(data);
          
          // Check if CSV uses exact template columns (skip mapping if perfect match)
          if (tableName === 'demandcom' || tableName === 'clients' || tableName === 'projects') {
            const templateSet = new Set(templateColumns.map(c => c.toLowerCase()));
            const isPerfectTemplateMatch = fileColumns.every(col => 
              templateSet.has(col.toLowerCase())
            );
            
            if (isPerfectTemplateMatch) {
              // Direct 1:1 mapping - skip the mapper UI
              const directMapping = fileColumns.reduce((acc, col) => {
                // Find exact template column (case-insensitive match)
                const templateCol = templateColumns.find(t => t.toLowerCase() === col.toLowerCase());
                acc[col] = templateCol || col;
                return acc;
              }, {} as Record<string, string>);
              
              setColumnMapping(directMapping);
              setShowColumnMapper(false);
              toast({
                title: "Template Detected",
                description: "CSV matches template format. Ready to import!",
              });
            } else {
              setShowColumnMapper(true);
            }
          }
        }
      },
      error: (error) => {
        setValidationErrors([`Error parsing CSV: ${error.message}`]);
      },
    });
  };

  // Use hybrid Postgres approach for demandcom
  const useHybridApproach = (table: string) => ['demandcom'].includes(table);
  
  // Use background processing for master table (self-chaining pattern)
  const useBackgroundProcessing = (table: string) => table === 'master';

  const CHUNK_SIZE = 10000; // 10k records per request to avoid memory limits
  const STAGING_CHUNK_SIZE = 5000; // Records per staging insert for background imports
  const BACKGROUND_POLL_INTERVAL = 3000; // Poll every 3 seconds for background imports

  const handleHybridImport = async (transformedData: any[], newImportId: string) => {
    console.log(`[Hybrid Import] Starting for ${tableName} with ${transformedData.length} records`);
    
    const totalChunks = Math.ceil(transformedData.length / CHUNK_SIZE);
    console.log(`[Hybrid Import] Will process in ${totalChunks} chunks of ${CHUNK_SIZE} records each`);
    
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalFailed = 0;
    let allErrors: any[] = [];
    let totalStagingMs = 0;
    let totalProcessingMs = 0;

    setTotalBatches(totalChunks);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, transformedData.length);
      const chunk = transformedData.slice(start, end);

      // Update progress
      setCurrentBatch(i + 1);
      setProcessedCount(start);

      console.log(`[Hybrid Import] Processing chunk ${i + 1}/${totalChunks} (${chunk.length} records)`);

      const { data: result, error: hybridError } = await supabase.functions.invoke(
        'process-import-hybrid',
        {
          body: {
            importId: newImportId,
            records: chunk,
            tableName,
            isPartial: true,
            chunkNumber: i + 1,
            totalChunks,
          },
        }
      );

      if (hybridError) {
        console.error(`[Hybrid Import] Chunk ${i + 1} error:`, hybridError);
        throw hybridError;
      }

      console.log(`[Hybrid Import] Chunk ${i + 1} result:`, result);

      totalInserted += result.inserted || 0;
      totalUpdated += result.updated || 0;
      totalFailed += result.failed || 0;
      allErrors = [...allErrors, ...(result.errors || [])];
      totalStagingMs += result.timing?.staging_ms || 0;
      totalProcessingMs += result.timing?.processing_ms || 0;

      setSuccessCount(totalInserted);
      setUpdatedCount(totalUpdated);
      setFailedCount(totalFailed);
      setProcessedCount(end);

      // Calculate estimated time remaining
      if (startTime && i > 0) {
        const elapsedMs = Date.now() - startTime;
        const avgTimePerChunk = elapsedMs / (i + 1);
        const remainingChunks = totalChunks - (i + 1);
        const estimatedRemainingMs = avgTimePerChunk * remainingChunks;

        const minutes = Math.floor(estimatedRemainingMs / 60000);
        const seconds = Math.floor((estimatedRemainingMs % 60000) / 1000);
        
        if (minutes > 0) {
          setEstimatedTimeRemaining(`${minutes}m ${seconds}s`);
        } else {
          setEstimatedTimeRemaining(`${seconds}s`);
        }
      }
    }

    const isSuccessful = totalFailed === 0 || totalInserted > 0;
    
    setImportResult({
      success: isSuccessful,
      cancelled: false,
      inserted: totalInserted,
      updated: totalUpdated,
      failed: totalFailed,
      total: transformedData.length,
      errors: allErrors.slice(0, 100),
      timing: {
        staging_ms: totalStagingMs,
        processing_ms: totalProcessingMs,
        total_ms: totalStagingMs + totalProcessingMs,
      },
    });

    if (isSuccessful) {
      const totalSuccess = totalInserted + totalUpdated;
      const updateMsg = totalUpdated > 0 ? ` (${totalInserted} new, ${totalUpdated} updated)` : '';
      toast({
        title: "Import Completed",
        description: `Successfully processed ${totalSuccess} of ${transformedData.length} records${updateMsg} in ${Math.round((totalStagingMs + totalProcessingMs) / 1000)}s`,
      });
    } else {
      toast({
        title: "Import Failed",
        description: "The import encountered errors",
        variant: "destructive",
      });
    }
  };

  // Background import for master table using self-chaining pattern
  const handleBackgroundImport = async (transformedData: any[], newImportId: string) => {
    console.log(`[Background Import] Starting for ${tableName} with ${transformedData.length} records`);
    
    // Step 1: Upload all records to staging table in chunks
    const totalChunks = Math.ceil(transformedData.length / STAGING_CHUNK_SIZE);
    console.log(`[Background Import] Uploading to staging in ${totalChunks} chunks`);
    
    setTotalBatches(totalChunks);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * STAGING_CHUNK_SIZE;
      const end = Math.min(start + STAGING_CHUNK_SIZE, transformedData.length);
      const chunk = transformedData.slice(start, end);

      setCurrentBatch(i + 1);
      setProcessedCount(start);

      const stagingRecords = chunk.map((record, idx) => ({
        import_id: newImportId,
        row_number: start + idx + 1,
        raw_data: record,
        processed: false,
      }));

      const { error: stagingError } = await supabase
        .from('import_staging')
        .insert(stagingRecords);

      if (stagingError) {
        console.error(`[Background Import] Staging chunk ${i + 1} error:`, stagingError);
        throw new Error(`Failed to upload data: ${stagingError.message}`);
      }

      console.log(`[Background Import] Staged chunk ${i + 1}/${totalChunks}`);
    }

    console.log(`[Background Import] All data staged. Triggering background processing...`);
    setProcessedCount(transformedData.length);

    // Step 2: Trigger background processing (fire-and-forget)
    const { data: bgResult, error: bgError } = await supabase.functions.invoke(
      'process-import-background',
      {
        body: {
          import_id: newImportId,
          table_name: tableName,
        },
      }
    );

    if (bgError) {
      console.error('[Background Import] Failed to start background processing:', bgError);
      throw bgError;
    }

    console.log('[Background Import] Background processing started:', bgResult);

    toast({
      title: "Import Started",
      description: `${transformedData.length} records uploaded. Processing in background...`,
    });

    // Step 3: Poll for status updates
    await pollBackgroundImportStatus(newImportId, transformedData.length);
  };

  // Poll for background import status
  const pollBackgroundImportStatus = async (importId: string, totalRecords: number) => {
    let isComplete = false;
    let pollCount = 0;
    const maxPolls = 7200; // Max 6 hours of polling (3s interval)

    while (!isComplete && pollCount < maxPolls) {
      await new Promise(resolve => setTimeout(resolve, BACKGROUND_POLL_INTERVAL));
      pollCount++;

      const { data: importStatus, error: statusError } = await supabase
        .from('bulk_import_history')
        .select('*')
        .eq('id', importId)
        .single();

      if (statusError) {
        console.error('Error fetching import status:', statusError);
        continue;
      }

      // Update progress state
      setCurrentBatch(importStatus.current_batch || 0);
      setTotalBatches(importStatus.total_batches || 0);
      setProcessedCount(importStatus.processed_records || 0);
      setSuccessCount(importStatus.successful_records || 0);
      setFailedCount(importStatus.failed_records || 0);

      // Calculate estimated time remaining
      if (startTime && importStatus.processed_records > 0) {
        const elapsedMs = Date.now() - startTime;
        const recordsPerMs = importStatus.processed_records / elapsedMs;
        const remainingRecords = totalRecords - importStatus.processed_records;
        const estimatedRemainingMs = remainingRecords / recordsPerMs;

        const minutes = Math.floor(estimatedRemainingMs / 60000);
        const seconds = Math.floor((estimatedRemainingMs % 60000) / 1000);
        
        if (minutes > 0) {
          setEstimatedTimeRemaining(`${minutes}m ${seconds}s`);
        } else if (seconds > 0) {
          setEstimatedTimeRemaining(`${seconds}s`);
        }
      }

      // Check if import is complete
      const statusStr = importStatus.status as string;
      const completedStatuses = ['completed', 'failed', 'partial', 'cancelled'];
      if (completedStatuses.includes(statusStr)) {
        isComplete = true;

        const isSuccessful = statusStr === 'completed' || statusStr === 'partial';
        const totalSuccess = (importStatus.successful_records || 0);
        
        setImportResult({
          success: isSuccessful,
          cancelled: importStatus.status === 'cancelled',
          inserted: totalSuccess,
          updated: 0, // Background import tracks combined
          failed: importStatus.failed_records || 0,
          total: totalRecords,
          errors: importStatus.error_log || [],
        });

        if (isSuccessful) {
          toast({
            title: "Import Completed",
            description: `Successfully processed ${totalSuccess} of ${totalRecords} records`,
          });
        } else if (importStatus.status === 'cancelled') {
          toast({
            title: "Import Cancelled",
            description: "The import was cancelled",
          });
        } else {
          toast({
            title: "Import Failed",
            description: "The import encountered errors",
            variant: "destructive",
          });
        }
      }
    }

    if (!isComplete) {
      toast({
        title: "Import Still Processing",
        description: "The import is still running in background. Check history for updates.",
      });
    }
  };

  const handleLegacyImport = async (transformedData: any[], newImportId: string, batches: number) => {
    // Step 2: Start background import job (legacy approach)
    const { error: jobError } = await supabase.functions.invoke(
      'process-import-job',
      {
        body: {
          importId: newImportId,
          csvData: transformedData,
          tableName,
        },
      }
    );

    if (jobError) {
      console.error('Failed to start import job:', jobError);
      throw jobError;
    }

    // Step 3: Poll for progress until complete
    let isComplete = false;
    let pollCount = 0;
    const maxPolls = 3600; // Max 2 hours of polling (2s interval)

    while (!isComplete && pollCount < maxPolls) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      pollCount++;

      const { data: importStatus, error: statusError } = await supabase
        .from('bulk_import_history')
        .select('*')
        .eq('id', newImportId)
        .single();

      if (statusError) {
        console.error('Error fetching import status:', statusError);
        continue;
      }

      // Update progress state
      setCurrentBatch(importStatus.current_batch || 0);
      setProcessedCount(importStatus.processed_records || 0);
      setSuccessCount(importStatus.successful_records || 0);
      setFailedCount(importStatus.failed_records || 0);

      // Calculate estimated time remaining
      if (startTime && importStatus.current_batch > 0) {
        const elapsedMs = Date.now() - startTime;
        const avgTimePerBatch = elapsedMs / importStatus.current_batch;
        const remainingBatches = batches - importStatus.current_batch;
        const estimatedRemainingMs = avgTimePerBatch * remainingBatches;

        const minutes = Math.floor(estimatedRemainingMs / 60000);
        const seconds = Math.floor((estimatedRemainingMs % 60000) / 1000);
        
        if (minutes > 0) {
          setEstimatedTimeRemaining(`${minutes}m ${seconds}s`);
        } else {
          setEstimatedTimeRemaining(`${seconds}s`);
        }
      }

      // Check if import is complete
      const statusStr = importStatus.status as string;
      const completedStatuses = ['completed', 'failed', 'partial', 'cancelled'];
      if (completedStatuses.includes(statusStr)) {
        isComplete = true;

        const isSuccessful = statusStr === 'completed' || statusStr === 'partial';
        
        setImportResult({
          success: isSuccessful,
          cancelled: importStatus.status === 'cancelled',
          inserted: importStatus.successful_records || 0,
          failed: importStatus.failed_records || 0,
          total: transformedData.length,
          errors: importStatus.error_log || [],
        });

        if (isSuccessful) {
          toast({
            title: "Import Completed",
            description: `Successfully imported ${importStatus.successful_records || 0} of ${transformedData.length} records`,
          });
        } else if (importStatus.status === 'cancelled') {
          toast({
            title: "Import Cancelled",
            description: "The import was cancelled by user",
          });
        } else {
          toast({
            title: "Import Failed",
            description: "The import encountered errors",
            variant: "destructive",
          });
        }
      }
    }

    if (!isComplete) {
      toast({
        title: "Import Timeout",
        description: "The import is taking longer than expected. Please check the history for updates.",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (!file || parsedData.length === 0) return;

    setIsProcessing(true);
    setImportResult(null);
    setShowColumnMapper(false);
    setStartTime(Date.now());
    setEstimatedTimeRemaining(null);

    try {
      // Transform data based on column mappings (only if mappings exist)
      const transformedData = Object.keys(columnMapping).length > 0
        ? parsedData.map((row) => {
            const newRow: any = {};
            Object.entries(columnMapping).forEach(([csvCol, dbCol]) => {
              if (dbCol !== '_skip') {
                newRow[dbCol] = row[csvCol];
              }
            });
            return newRow;
          })
        : parsedData; // Use original data if no mapping (e.g., for projects with fixed template)

      // Step 1: Create import session
      const { data: sessionData, error: sessionError } = await supabase.functions.invoke(
        'create-import-session',
        {
          body: {
            tableName,
            fileName: file.name,
            totalRecords: transformedData.length,
          },
        }
      );

      if (sessionError) throw sessionError;

      const { importId: newImportId, totalBatches: batches, batchSize: responseBatchSize } = sessionData;
      setImportId(newImportId);
      setTotalBatches(batches);
      setBatchSize(responseBatchSize || 5000);

      // Choose import approach based on table
      if (useBackgroundProcessing(tableName)) {
        await handleBackgroundImport(transformedData, newImportId);
      } else if (useHybridApproach(tableName)) {
        await handleHybridImport(transformedData, newImportId);
      } else {
        await handleLegacyImport(transformedData, newImportId, batches);
      }

      fetchImportHistory();
      onImportComplete?.();
    } catch (error: any) {
      console.error("Import error:", error);
      toast({
        title: "Import Failed",
        description: error.message || "An error occurred during import",
        variant: "destructive",
      });
      setImportResult({
        success: false,
        error: error.message || "Import failed",
      });
    } finally {
      setIsProcessing(false);
      setImportId(null);
      setStartTime(null);
      setEstimatedTimeRemaining(null);
    }
  };

  const handleCancel = async () => {
    if (!importId) return;

    setIsCancelling(true);
    try {
      await supabase.functions.invoke('cancel-import', {
        body: { importId },
      });

      toast({
        title: "Import Cancelled",
        description: "The import has been cancelled. Processed records remain in the database.",
      });
    } catch (error: any) {
      console.error('Cancel error:', error);
      toast({
        title: "Cancel Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRevert = async () => {
    if (!revertImportId) return;

    setIsReverting(true);
    try {
      const { data, error } = await supabase.functions.invoke('revert-import', {
        body: { importId: revertImportId },
      });

      if (error) throw error;

      toast({
        title: "Import Reverted",
        description: data.message || "All records from this import have been deleted",
      });

      fetchImportHistory();
      onImportComplete?.();
      setShowRevertDialog(false);
      setRevertImportId(null);
    } catch (error: any) {
      console.error('Revert error:', error);
      toast({
        title: "Revert Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsReverting(false);
    }
  };

  const handleClose = () => {
    if (isProcessing) {
      toast({
        title: "Import in Progress",
        description: "Please cancel the import first before closing",
        variant: "destructive",
      });
      return;
    }

    setFile(null);
    setParsedData([]);
    setValidationErrors([]);
    setImportResult(null);
    setCurrentBatch(0);
    setTotalBatches(0);
    setProcessedCount(0);
    setSuccessCount(0);
    setFailedCount(0);
    setShowColumnMapper(false);
    setColumnMapping({});
    setCsvHeaders([]);
    setStartTime(null);
    setEstimatedTimeRemaining(null);
    onOpenChange(false);
  };

  const handleMappingConfirmed = (mapping: Record<string, string>) => {
    setColumnMapping(mapping);
    setShowColumnMapper(false);
  };

  const handleMappingCancel = () => {
    setShowColumnMapper(false);
    setFile(null);
    setParsedData([]);
    setCsvHeaders([]);
  };

  // Define database columns based on table name
  const getClientsColumns = (): DbColumn[] => [
    { name: "company_name", label: "Company Name", type: "text", required: true },
    { name: "contact_name", label: "Contact Name", type: "text", required: true },
    { name: "official_address", label: "Official Address", type: "text" },
    { name: "residence_address", label: "Residence Address", type: "text" },
    { name: "contact_number", label: "Contact Number", type: "text" },
    { name: "email_id", label: "Email ID", type: "text" },
    { name: "birthday_date", label: "Birthday Date", type: "date" },
    { name: "anniversary_date", label: "Anniversary Date", type: "date" },
    { name: "company_linkedin_page", label: "Company LinkedIn Page", type: "text" },
    { name: "linkedin_id", label: "LinkedIn ID", type: "text" },
  ];

  const getProjectsColumns = (): DbColumn[] => [
    { name: "Project Number", label: "Project Number", type: "text", required: true },
    { name: "Project Name", label: "Project Name", type: "text", required: true },
    { name: "Project Owner Email", label: "Project Owner Email", type: "text", required: true },
    { name: "Team Member Email", label: "Team Member Email", type: "text", required: true },
    { name: "Team Member Role (owner/member/lead/coordinator)", label: "Team Member Role", type: "text", required: false },
    { name: "Client Name", label: "Client Name", type: "text" },
    { name: "Contact Name", label: "Contact Name", type: "text" },
    { name: "City", label: "City", type: "text" },
    { name: "Venue", label: "Venue", type: "text" },
    { name: "Event Date (YYYY-MM-DD or M/D/YYYY)", label: "Event Date", type: "text" },
    { name: "Event Type (full_day/first_half/second_half)", label: "Event Type", type: "text" },
    { name: "Project Source (inbound/outbound/reference)", label: "Project Source", type: "text" },
    { name: "Project Value", label: "Project Value", type: "text" },
    { name: "Management Fees", label: "Management Fees", type: "text" },
    { name: "Expected A-Factor", label: "Expected A-Factor", type: "text" },
    { name: "Final A-Factor", label: "Final A-Factor", type: "text" },
    { name: "Status (pitched/in_discussion/estimate_shared/po_received/execution/invoiced/closed/lost)", label: "Status", type: "text" },
    { name: "Closed Reason", label: "Closed Reason", type: "text" },
    { name: "Lost Reason", label: "Lost Reason", type: "text" },
    { name: "Brief", label: "Brief", type: "text" },
  ];

  const getDemandcomColumns = (): DbColumn[] => [
    { name: "name", label: "Name", type: "text", required: true },
    { name: "mobile_numb", label: "Mobile Number", type: "text", required: true },
    { name: "assigned_to", label: "Assigned To (Email)", type: "text" },
    { name: "activity_name", label: "Activity Name", type: "text" },
    { name: "designation", label: "Designation", type: "text" },
    { name: "deppt", label: "Department", type: "text" },
    { name: "job_level_updated", label: "Job Level", type: "text" },
    { name: "linkedin", label: "LinkedIn", type: "text" },
    { name: "mobile2", label: "Mobile 2", type: "text" },
    { name: "official", label: "Official Email", type: "text" },
    { name: "personal_email_id", label: "Personal Email", type: "text" },
    { name: "generic_email_id", label: "Generic Email", type: "text" },
    { name: "industry_type", label: "Industry Type", type: "text" },
    { name: "sub_industry", label: "Sub Industry", type: "text" },
    { name: "company_name", label: "Company Name", type: "text" },
    { name: "address", label: "Address", type: "text" },
    { name: "location", label: "Location", type: "text" },
    { name: "head_office_location", label: "Head Office Location", type: "text" },
    { name: "city", label: "City", type: "text" },
    { name: "state", label: "State", type: "text" },
    { name: "pincode", label: "Pincode", type: "text" },
    { name: "zone", label: "Zone", type: "text" },
    { name: "tier", label: "Tier", type: "text" },
    { name: "website", label: "Website", type: "text" },
    { name: "turnover", label: "Turnover", type: "text" },
    { name: "emp_size", label: "Employee Size", type: "text" },
    { name: "erp_name", label: "ERP Name", type: "text" },
    { name: "erp_vendor", label: "ERP Vendor", type: "text" },
    { name: "country", label: "Country", type: "text" },
    { name: "source", label: "Source", type: "text" },
    { name: "source_1", label: "Source 1", type: "text" },
    { name: "extra", label: "Extra", type: "text" },
    { name: "extra_1", label: "Extra 1", type: "text" },
    { name: "extra_2", label: "Extra 2", type: "text" },
    { name: "user_id", label: "User ID", type: "text" },
    { name: "salutation", label: "Salutation", type: "text" },
    { name: "turnover_link", label: "Turnover Link", type: "text" },
    { name: "company_linkedin_url", label: "Company LinkedIn URL", type: "text" },
    { name: "associated_member_linkedin", label: "Associated Member on LinkedIn", type: "text" },
    { name: "latest_disposition", label: "Latest Disposition", type: "text" },
    { name: "latest_subdisposition", label: "Latest Sub-Disposition", type: "text" },
    { name: "updated_at", label: "Last Update Date", type: "text" },
    { name: "assigned_by", label: "Assigned By", type: "text" },
  ];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      completed: { variant: "default", icon: CheckCircle, label: "Success" },
      failed: { variant: "destructive", icon: AlertCircle, label: "Failed" },
      cancelled: { variant: "secondary", icon: X, label: "Cancelled" },
      processing: { variant: "secondary", icon: Clock, label: "Processing" },
    };

    const config = variants[status] || variants.processing;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const progress = totalBatches > 0 ? (processedCount / parsedData.length) * 100 : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Import {tableLabel}</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import multiple records (Maximum {MAX_RECORDS} records per file)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Optimization Info */}
            {tableName === 'projects' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Note:</strong> Project imports process in batches of 250 records. Large imports may take a few minutes.
                </AlertDescription>
              </Alert>
            )}

            {/* Download Template */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Download Template</p>
                <p className="text-sm text-muted-foreground">
                  Get the CSV template with required columns
                </p>
              </div>
              <Button onClick={handleDownloadTemplate} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
            </div>

            {/* Column Mapper */}
            {showColumnMapper && csvHeaders.length > 0 && (
              <CsvColumnMapper
                csvHeaders={csvHeaders}
                csvData={parsedData}
                dbColumns={
                  tableName === 'clients' ? getClientsColumns() :
                  tableName === 'projects' ? getProjectsColumns() :
                  getDemandcomColumns()
                }
                onMappingConfirmed={handleMappingConfirmed}
                onCancel={handleMappingCancel}
              />
            )}

            {/* File Upload */}
            {!isProcessing && !importResult && !showColumnMapper && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="flex-1"
                    disabled={isProcessing}
                  />
                  {(tableName !== 'demandcom' && tableName !== 'clients') && (
                    <Button
                      onClick={handleImport}
                      disabled={parsedData.length === 0 || validationErrors.length > 0}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Import {parsedData.length > 0 && `${parsedData.length} Records`}
                    </Button>
                  )}
                  {(tableName === 'demandcom' || tableName === 'clients') && Object.keys(columnMapping).length > 0 && (
                    <Button onClick={handleImport}>
                      <Upload className="mr-2 h-4 w-4" />
                      Import {parsedData.length} Records
                    </Button>
                  )}
                </div>

                {file && parsedData.length > 0 && validationErrors.length === 0 && !showColumnMapper && tableName === 'demandcom' && Object.keys(columnMapping).length > 0 && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Column mapping confirmed. {parsedData.length} records ready to import.
                    </AlertDescription>
                  </Alert>
                )}

                {file && parsedData.length > 0 && validationErrors.length === 0 && tableName !== 'demandcom' && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      File validated successfully. {parsedData.length} records ready to import.
                    </AlertDescription>
                  </Alert>
                )}

                {validationErrors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-semibold mb-2">Validation Errors:</div>
                      <ul className="list-disc pl-5 space-y-1">
                        {validationErrors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Processing Progress */}
            {isProcessing && (
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Importing Records...</p>
                    <p className="text-sm text-muted-foreground">
                      Processing batch {currentBatch} of {totalBatches}
                      {estimatedTimeRemaining && ` • Est. ${estimatedTimeRemaining} remaining`}
                    </p>
                  </div>
                  <Button
                    onClick={handleCancel}
                    variant="destructive"
                    size="sm"
                    disabled={isCancelling}
                  >
                    {isCancelling ? "Cancelling..." : "Cancel Import"}
                  </Button>
                </div>

                <Progress value={progress} className="w-full" />

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Processed</p>
                    <p className="font-semibold">{processedCount} / {parsedData.length}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Successful</p>
                    <p className="font-semibold text-green-600">{successCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Failed</p>
                    <p className="font-semibold text-red-600">{failedCount}</p>
                  </div>
                </div>

                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{Math.round(progress)}% complete</span>
                  {tableName === 'projects' && (
                    <span>Using batch size of {batchSize} (optimized for projects)</span>
                  )}
                </div>
              </div>
            )}

            {/* Import Result */}
            {importResult && (
              <Alert variant={importResult.success ? "default" : "destructive"}>
                {importResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  <div className="font-semibold mb-2">
                    {importResult.cancelled
                      ? "Import Cancelled"
                      : importResult.success
                      ? "Import Completed"
                      : "Import Failed"}
                  </div>
                  {importResult.success && (
                    <div className="space-y-1">
                      {importResult.inserted > 0 && (
                        <p>New records inserted: {importResult.inserted}</p>
                      )}
                      {importResult.updated > 0 && (
                        <p>Existing records updated: {importResult.updated}</p>
                      )}
                      {importResult.inserted === 0 && importResult.updated === 0 && (
                        <p>No records were processed</p>
                      )}
                      {importResult.failed > 0 && (
                        <p className="text-red-600">Failed: {importResult.failed} records</p>
                      )}
                    </div>
                  )}
                  {importResult.cancelled && (
                    <p>
                      {importResult.inserted} of {importResult.total} records were imported
                      before cancellation.
                    </p>
                  )}
                  {importResult.error && <p>{importResult.error}</p>}
                </AlertDescription>
              </Alert>
            )}

            {/* Import History */}
            {importHistory.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Recent Imports</h3>
                  <Button
                    onClick={fetchImportHistory}
                    variant="ghost"
                    size="sm"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  {importHistory.map((item) => (
                    <div key={item.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{item.file_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(item.created_at), 'PPpp')}
                          </p>
                        </div>
                        {getStatusBadge(item.status)}
                      </div>

                      <div className="text-sm">
                        <p>
                          {item.successful_records} / {item.total_records} records imported
                        </p>
                        {item.failed_records > 0 && (
                          <p className="text-red-600">{item.failed_records} failed</p>
                        )}
                      </div>

                      {item.can_revert && !item.reverted_at && (
                        <Button
                          onClick={() => {
                            setRevertImportId(item.id);
                            setShowRevertDialog(true);
                          }}
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                        >
                          Revert Import
                        </Button>
                      )}

                      {item.reverted_at && (
                        <p className="text-sm text-muted-foreground">
                          Reverted on {format(new Date(item.reverted_at), 'PPpp')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={handleClose} variant="outline" disabled={isProcessing}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revert Confirmation Dialog */}
      <Dialog open={showRevertDialog} onOpenChange={setShowRevertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>⚠️ Confirm Revert Import</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all records from this import?
            </DialogDescription>
          </DialogHeader>

          {revertImportId && (
            <div className="space-y-2">
              {(() => {
                const item = importHistory.find((h) => h.id === revertImportId);
                return item ? (
                  <>
                    <p>
                      <strong>Import:</strong> {item.file_name}
                    </p>
                    <p>
                      <strong>Records to delete:</strong> {item.successful_records}
                    </p>
                    <p>
                      <strong>Imported:</strong>{" "}
                      {format(new Date(item.created_at), "PPpp")}
                    </p>
                  </>
                ) : null;
              })()}
            </div>
          )}

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This action cannot be undone. All records from this import will be permanently
              deleted.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowRevertDialog(false);
                setRevertImportId(null);
              }}
              variant="outline"
              disabled={isReverting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRevert}
              variant="destructive"
              disabled={isReverting}
            >
              {isReverting ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Reverting...
                </>
              ) : (
                "Yes, Revert Import"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}