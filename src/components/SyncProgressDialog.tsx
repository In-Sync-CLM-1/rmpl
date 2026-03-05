import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSyncProgress } from "@/hooks/useSyncProgress";
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";

interface SyncProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syncId: string | null;
  onComplete?: () => void;
}

export function SyncProgressDialog({
  open,
  onOpenChange,
  syncId,
  onComplete,
}: SyncProgressDialogProps) {
  const { progress, isCompleted } = useSyncProgress(syncId);

  const progressPercent = progress?.total_batches
    ? Math.round((progress.current_batch / progress.total_batches) * 100)
    : 0;

  const handleClose = () => {
    onOpenChange(false);
    if (isCompleted && onComplete) {
      onComplete();
    }
  };

  const getStatusIcon = () => {
    if (!progress) return <Loader2 className="h-5 w-5 animate-spin" />;
    
    switch (progress.status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'partial':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Loader2 className="h-5 w-5 animate-spin" />;
    }
  };

  const getStatusText = () => {
    if (!progress) return 'Initializing...';
    
    switch (progress.status) {
      case 'running':
        return `Processing batch ${progress.current_batch} of ${progress.total_batches}`;
      case 'completed':
        return 'Sync completed successfully!';
      case 'partial':
        return 'Sync completed with some failures';
      case 'failed':
        return 'Sync failed';
      default:
        return progress.status;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStatusIcon()}
            DemandCom → Master Sync
          </DialogTitle>
          <DialogDescription>{getStatusText()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
            {progress?.total_batches ? (
              <p className="text-xs text-muted-foreground text-center">
                Batch {progress.current_batch} of {progress.total_batches}
              </p>
            ) : null}
          </div>

          {/* Stats Grid */}
          {progress && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">Processed</p>
                <p className="text-2xl font-bold">{progress.items_fetched || 0}</p>
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">Inserted</p>
                <p className="text-2xl font-bold text-green-600">
                  {progress.items_inserted || 0}
                </p>
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">Updated</p>
                <p className="text-2xl font-bold text-blue-600">
                  {progress.items_updated || 0}
                </p>
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600">
                  {progress.items_failed || 0}
                </p>
              </div>
            </div>
          )}

          {/* Duration (when completed) */}
          {isCompleted && progress?.duration_seconds && (
            <div className="text-sm text-muted-foreground text-center">
              Duration: {(progress.duration_seconds / 60).toFixed(2)} minutes
            </div>
          )}

          {/* Error Details */}
          {progress?.items_failed > 0 && progress?.error_details && isCompleted && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Failed Records:</p>
              <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                {JSON.stringify(progress.error_details, null, 2)}
              </pre>
            </div>
          )}

          {/* Close Button */}
          <Button onClick={handleClose} className="w-full">
            {isCompleted ? 'Close' : 'Run in Background'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}